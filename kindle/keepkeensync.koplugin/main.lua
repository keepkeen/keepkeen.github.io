local DataStorage = require("datastorage")
local Device = require("device")
local DocSettings = require("docsettings")
local InfoMessage = require("ui/widget/infomessage")
local LuaSettings = require("luasettings")
local NetworkMgr = require("ui/network/manager")
local Notification = require("ui/widget/notification")
local Trapper = require("ui/trapper")
local UIManager = require("ui/uimanager")
local WidgetContainer = require("ui/widget/container/widgetcontainer")
local ffiUtil = require("ffi/util")
local lfs = require("libs/libkoreader-lfs")
local logger = require("logger")
local ltn12 = require("ltn12")
local rapidjson = require("rapidjson")
local sha256 = require("ffi/sha2").sha256
local socket = require("socket")
local http = require("socket.http")
local socketutil = require("socketutil")
local util = require("util")

local MANIFEST_URL = "https://keepkeen.github.io/ebooks/library.json"
local LIBRARY_ROOT = Device.home_dir .. "/documents/KeepKeen Blog"
local AUTO_SYNC_INTERVAL = 24 * 60 * 60
local FAILED_SYNC_RETRY_INTERVAL = 60 * 60
local LEGACY_PATHS_BY_SLUG = {
    ["china-agent-interview-guide-2025-2026"] = "china-agent-interview-guide-2025-2026.epub",
    ["rl-paper-03-gae"] = "rl-paper-03-gae.epub",
    ["slime-debugging-reliability-performance"] = "slime-debugging-reliability-performance.epub",
}
local LEGACY_PATH_SET = {}
for _, path in pairs(LEGACY_PATHS_BY_SLUG) do LEGACY_PATH_SET[path] = true end

local KeepKeenSync = WidgetContainer:extend{
    name = "keepkeensync",
    is_doc_only = false,
}

local RECOMMENDED_PROFILES = {
    ["技术博客"] = {
        settings = {
            name = "技术博客",
            order = {
                "set_font", "font_size", "font_gamma", "font_base_weight",
                "font_hinting", "font_kerning", "h_page_margins",
                "t_page_margin", "b_page_margin", "sync_t_b_page_margins",
                "view_mode", "block_rendering_mode", "line_spacing",
                "embedded_css", "embedded_fonts", "status_line",
            },
        },
        set_font = "Noto Serif",
        font_size = 25,
        font_gamma = 25,
        font_base_weight = 0,
        font_hinting = 2,
        font_kerning = 3,
        h_page_margins = { 10, 10 },
        t_page_margin = 15,
        b_page_margin = 15,
        sync_t_b_page_margins = true,
        view_mode = "page",
        block_rendering_mode = 2,
        line_spacing = 125,
        embedded_css = true,
        embedded_fonts = true,
        status_line = 1,
    },
    ["小说阅读"] = {
        settings = {
            name = "小说阅读",
            order = {
                "set_font", "font_size", "font_gamma", "font_base_weight",
                "font_hinting", "font_kerning", "h_page_margins",
                "t_page_margin", "b_page_margin", "sync_t_b_page_margins",
                "view_mode", "block_rendering_mode", "line_spacing",
                "embedded_css", "embedded_fonts", "status_line",
            },
        },
        set_font = "Noto Serif",
        font_size = 23,
        font_gamma = 15,
        font_base_weight = 0,
        font_hinting = 2,
        font_kerning = 3,
        h_page_margins = { 5, 5 },
        t_page_margin = 10,
        b_page_margin = 10,
        sync_t_b_page_margins = true,
        view_mode = "page",
        block_rendering_mode = 2,
        line_spacing = 120,
        embedded_css = true,
        embedded_fonts = true,
        status_line = 1,
    },
}

local function is_file(path)
    return lfs.attributes(path, "mode") == "file"
end

local function sha256_file(path)
    local file = io.open(path, "rb")
    if not file then return nil end
    local update = sha256()
    while true do
        local chunk = file:read(64 * 1024)
        if not chunk then break end
        update(chunk)
    end
    file:close()
    return update()
end

local function safe_relative_path(relative_path)
    if type(relative_path) ~= "string"
            or relative_path == ""
            or relative_path:sub(1, 1) == "/"
            or relative_path:find("\\", 1, true)
            or relative_path:find("//", 1, true)
            or relative_path:sub(-5) ~= ".epub" then
        return false
    end
    local component_count = 0
    for component in relative_path:gmatch("[^/]+") do
        if component == "." or component == ".." or component == "" then return false end
        component_count = component_count + 1
    end
    return component_count >= 2
end

local function valid_book(book)
    return type(book) == "table"
        and type(book.slug) == "string"
        and book.slug:match("^[a-z0-9][a-z0-9%-]*$") ~= nil
        and safe_relative_path(book.relativePath)
        and type(book.url) == "string"
        and book.url:match("^https://keepkeen%.github%.io/ebooks/") ~= nil
        and book.url:find("?v=", 1, true) ~= nil
        and type(book.bytes) == "number"
        and book.bytes > 0
        and type(book.sha256) == "string"
        and #book.sha256 == 64
        and book.sha256:match("^[0-9a-f]+$") ~= nil
end

local function safe_previous_path(relative_path)
    return safe_relative_path(relative_path) or LEGACY_PATH_SET[relative_path] == true
end

local function fetch_manifest()
    local sink = {}
    socketutil:set_timeout(socketutil.LARGE_BLOCK_TIMEOUT, socketutil.LARGE_TOTAL_TIMEOUT)
    local code, headers, status = socket.skip(1, http.request{
        url = MANIFEST_URL .. "?t=" .. tostring(os.time()),
        headers = {
            ["Accept"] = "application/json",
            ["Accept-Encoding"] = "identity",
            ["Cache-Control"] = "no-cache",
        },
        sink = ltn12.sink.table(sink),
    })
    socketutil:reset_timeout()
    if code ~= 200 or not headers then
        return nil, "同步清单下载失败：" .. tostring(status or code or "network unreachable")
    end

    local manifest, decode_error = rapidjson.decode(table.concat(sink))
    if not manifest then return nil, "同步清单 JSON 无效：" .. tostring(decode_error) end
    if manifest.schemaVersion ~= 1
            or manifest.rootDirectory ~= "KeepKeen Blog"
            or type(manifest.books) ~= "table"
            or type(manifest.bookCount) ~= "number"
            or manifest.bookCount ~= #manifest.books
            or manifest.bookCount < 1
            or manifest.bookCount > 1000
            or type(manifest.revision) ~= "string"
            or #manifest.revision ~= 64 then
        return nil, "同步清单结构或版本不受支持"
    end

    local seen_slugs, seen_paths = {}, {}
    for _, book in ipairs(manifest.books) do
        if not valid_book(book) then return nil, "同步清单包含不安全的书籍记录" end
        if seen_slugs[book.slug] or seen_paths[book.relativePath] then
            return nil, "同步清单包含重复书籍或路径"
        end
        seen_slugs[book.slug] = true
        seen_paths[book.relativePath] = true
    end
    return manifest
end

local function download_verified(book, destination)
    local part_path = destination .. ".part"
    local backup_path = destination .. ".keepkeen-backup"
    os.remove(part_path)
    os.remove(backup_path)

    local directory = ffiUtil.dirname(destination)
    local made, make_error = util.makePath(directory)
    if not made then return false, "无法创建目录：" .. tostring(make_error or directory) end

    local output, open_error = io.open(part_path, "wb")
    if not output then return false, "无法写入临时文件：" .. tostring(open_error) end

    socketutil:set_timeout(socketutil.FILE_BLOCK_TIMEOUT, socketutil.FILE_TOTAL_TIMEOUT)
    local code, headers, status = socket.skip(1, http.request{
        url = book.url,
        headers = {
            ["Accept-Encoding"] = "identity",
            ["Cache-Control"] = "no-cache",
        },
        sink = socketutil.file_sink(output),
    })
    socketutil:reset_timeout()
    if code ~= 200 or not headers then
        os.remove(part_path)
        return false, "下载失败：" .. tostring(status or code or "network unreachable")
    end

    local attributes = lfs.attributes(part_path)
    if not attributes or attributes.size ~= book.bytes then
        os.remove(part_path)
        return false, "下载大小校验失败"
    end
    if sha256_file(part_path) ~= book.sha256 then
        os.remove(part_path)
        return false, "下载 SHA-256 校验失败"
    end

    local had_existing = is_file(destination)
    if had_existing then
        local moved, move_error = os.rename(destination, backup_path)
        if not moved then
            os.remove(part_path)
            return false, "无法暂存旧文件：" .. tostring(move_error)
        end
    end
    local installed, install_error = os.rename(part_path, destination)
    if not installed then
        if had_existing then os.rename(backup_path, destination) end
        os.remove(part_path)
        return false, "无法安装新文件：" .. tostring(install_error)
    end
    if had_existing then os.remove(backup_path) end
    return true
end

local function migrate_sidecar(old_path, new_path)
    if not old_path or old_path == new_path then return true end
    local ok, migration_error = pcall(DocSettings.updateLocation, old_path, new_path, false)
    if not ok then return false, migration_error end
    return true
end

function KeepKeenSync:performSync()
    local manifest, manifest_error = fetch_manifest()
    if not manifest then return { failed = 1, errors = { manifest_error } } end

    local result = {
        revision = manifest.revision,
        checked = 0,
        updated = 0,
        unchanged = 0,
        failed = 0,
        errors = {},
        paths_by_slug = {},
    }
    local previous_paths = self.settings:readSetting("paths_by_slug", LEGACY_PATHS_BY_SLUG)

    for _, book in ipairs(manifest.books) do
        local destination = LIBRARY_ROOT .. "/" .. book.relativePath
        result.paths_by_slug[book.slug] = book.relativePath
        result.checked = result.checked + 1
        local attributes = lfs.attributes(destination)
        local unchanged = attributes
            and attributes.mode == "file"
            and attributes.size == book.bytes
            and sha256_file(destination) == book.sha256
        local installed = unchanged
        if unchanged then
            result.unchanged = result.unchanged + 1
        else
            local ok, download_error = download_verified(book, destination)
            if ok then
                installed = true
                result.updated = result.updated + 1
            else
                result.failed = result.failed + 1
                if #result.errors < 5 then
                    table.insert(result.errors, book.relativePath .. "：" .. tostring(download_error))
                end
            end
        end
        local old_relative = previous_paths[book.slug]
        if installed and old_relative and safe_previous_path(old_relative)
                and old_relative ~= book.relativePath then
            local old_path = LIBRARY_ROOT .. "/" .. old_relative
            local migrated, migration_error = migrate_sidecar(old_path, destination)
            if migrated then
                if is_file(old_path) then os.remove(old_path) end
            else
                result.failed = result.failed + 1
                result.paths_by_slug[book.slug] = old_relative
                if #result.errors < 5 then
                    table.insert(
                        result.errors,
                        old_relative .. "：阅读进度迁移失败：" .. tostring(migration_error)
                    )
                end
            end
        end
    end
    return result
end

function KeepKeenSync:saveResult(result)
    local now = os.time()
    self.settings:saveSetting("last_check", now)
    self.settings:saveSetting("last_checked_count", result.checked or 0)
    self.settings:saveSetting("last_updated_count", result.updated or 0)
    self.settings:saveSetting("last_failed_count", result.failed or 0)
    if result.failed == 0 and result.revision then
        self.settings:saveSetting("last_revision", result.revision)
        self.settings:saveSetting("paths_by_slug", result.paths_by_slug)
    end
    self.settings:flush()
end

function KeepKeenSync:showResult(result, interactive)
    if not result then
        if interactive then UIManager:show(InfoMessage:new{ text = "同步已取消。" }) end
        return
    end
    self:saveResult(result)
    if self.ui.file_chooser and (result.updated or 0) > 0 then self.ui.file_chooser:refreshPath() end

    local message = string.format(
        "KeepKeen 同步完成\n检查：%d 本\n更新：%d 本\n未变化：%d 本\n失败：%d 本",
        result.checked or 0,
        result.updated or 0,
        result.unchanged or 0,
        result.failed or 0
    )
    if result.errors and #result.errors > 0 then
        message = message .. "\n\n" .. table.concat(result.errors, "\n")
    end
    if interactive or (result.updated or 0) > 0 or (result.failed or 0) > 0 then
        UIManager:show(InfoMessage:new{ text = message })
    else
        logger.info(message)
    end
end

function KeepKeenSync:syncNow(interactive)
    if self.ui.document then
        if interactive then Notification:notify("请先返回 KOReader 文件管理器再同步。") end
        return
    end
    if self.syncing then return end
    local start_sync = function()
        if self.syncing then return end
        self.syncing = true
        local info = InfoMessage:new{ text = "正在同步 KeepKeen 博客…\n点按可取消" }
        UIManager:show(info)
        UIManager:forceRePaint()
        local completed, result = Trapper:dismissableRunInSubprocess(function()
            local ok, sync_result = pcall(function() return self:performSync() end)
            if not ok then
                return { failed = 1, errors = { "同步程序异常：" .. tostring(sync_result) } }
            end
            return sync_result
        end, info)
        if completed then UIManager:close(info) end
        self.syncing = false
        self:showResult(result, interactive)
    end
    if interactive then
        NetworkMgr:runWhenOnline(start_sync)
    elseif NetworkMgr:isOnline() then
        start_sync()
    end
end

function KeepKeenSync:maybeAutoSync()
    if not self.auto_sync or self.ui.document or self.syncing then return end
    local last_check = self.settings:readSetting("last_check", 0)
    local last_failed = self.settings:readSetting("last_failed_count", 0)
    local interval = last_failed > 0 and FAILED_SYNC_RETRY_INTERVAL or AUTO_SYNC_INTERVAL
    if os.time() - last_check >= interval then self:syncNow(false) end
end

function KeepKeenSync:_onResume()
    UIManager:scheduleIn(3, function() self:maybeAutoSync() end)
end

function KeepKeenSync:_onNetworkConnected()
    UIManager:scheduleIn(3, function() self:maybeAutoSync() end)
end

function KeepKeenSync:registerEvents()
    if self.auto_sync then
        self.onResume = self._onResume
        self.onNetworkConnected = self._onNetworkConnected
    else
        self.onResume = nil
        self.onNetworkConnected = nil
    end
end

function KeepKeenSync:installRecommendedProfiles()
    local profiles = self.ui.profiles
    if not profiles or type(profiles.data) ~= "table" then
        UIManager:show(InfoMessage:new{ text = "KOReader 配置档插件未加载，请重启 KOReader 后再试。" })
        return
    end
    for name, profile in pairs(RECOMMENDED_PROFILES) do
        profiles.data[name] = util.tableDeepCopy(profile)
    end
    profiles.updated = true
    profiles:onFlushSettings()
    UIManager:show(InfoMessage:new{
        text = "已安装推荐配置档：\n· 技术博客\n· 小说阅读\n\n打开书籍后，在“配置档 / Profiles”中选择并执行。",
    })
end

function KeepKeenSync:init()
    self.settings = LuaSettings:open(DataStorage:getSettingsDir() .. "/keepkeensync.lua")
    self.auto_sync = self.settings:readSetting("auto_sync", true)
    self:registerEvents()
    self.ui.menu:registerToMainMenu(self)
    UIManager:scheduleIn(5, function() self:maybeAutoSync() end)
end

function KeepKeenSync:addToMainMenu(menu_items)
    if self.ui.document then return end
    menu_items.keepkeen_sync = {
        text = "KeepKeen 博客同步",
        sorting_hint = "more_tools",
        sub_item_table = {
            {
                text = "立即同步",
                callback = function() self:syncNow(true) end,
            },
            {
                text = "每天联网后自动同步",
                checked_func = function() return self.auto_sync end,
                keep_menu_open = true,
                callback = function(touchmenu_instance)
                    self.auto_sync = not self.auto_sync
                    self.settings:saveSetting("auto_sync", self.auto_sync)
                    self.settings:flush()
                    self:registerEvents()
                    touchmenu_instance:updateItems()
                end,
            },
            {
                text = "安装 / 更新推荐阅读配置档",
                callback = function() self:installRecommendedProfiles() end,
            },
            {
                text_func = function()
                    local last_check = self.settings:readSetting("last_check")
                    if not last_check then return "上次同步：尚未运行" end
                    return string.format(
                        "上次同步：%s · 更新 %d · 失败 %d",
                        os.date("%Y-%m-%d %H:%M", last_check),
                        self.settings:readSetting("last_updated_count", 0),
                        self.settings:readSetting("last_failed_count", 0)
                    )
                end,
                enabled_func = function() return false end,
            },
        },
    }
end

return KeepKeenSync
