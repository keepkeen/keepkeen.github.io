---
title: "LeetCode Hot100 · 18 大算法模板与决策术"
description: "18 个主力算法模板的 9 件套：识别信号、解题步骤、Python 与 ACM 双模板、复杂度、Hot100 对应题与常见坑，末尾附把题目定位到模板的决策术。"
date: 2026-07-26
tags:
  - algorithms
  - leetcode
  - interview
featured: false
draft: false
lang: zh-CN
series: llm-algo-job-hunt
seriesOrder: 5
---

> 本文是个人求职工作区文档的发布版，最后核验 2026-07-26。指向工作区内未发布文件（模板、测试等）的链接已替换为纯文本；文中所有面经均为公开帖子的转述，证据分级见正文说明。

> 用法:先看最后的「决策术」把题目定位到某个模板,再翻到对应模板套路。
> 每个模板 9 件套:识别信号 / 为什么 / 解题步骤 / Python 模板 / ACM 模板 / 复杂度 / Hot100 对应题(按难度排序) / 常见坑 / 一句话口诀。
>
> **ACM 模板说明**:LeetCode 是「核心代码模式」(只写函数),ACM 是「自测模式」(自己读 stdin、打印 stdout)。下面每个模板的 ACM 版都给出「读入 → 建结构 → 调用 → 输出」的完整骨架,可直接本地 `python x.py < in.txt` 跑。

## 模板总览(先记这张表)

| # | 模板 | 一句话触发条件 |
|---|------|----------------|
| 1 | 哈希表 | 「是否出现过 / 配对 / 计数 / 分组」→ O(1) 查 |
| 2 | 双指针 | 有序数组 / 原地整理 / 首尾夹逼 |
| 3 | 滑动窗口 | 连续子串子数组 + 最长/最短/定长 |
| 4 | 前缀和 | 子数组「和 / 差」为定值、区间和反复查 |
| 5 | 栈 | 括号匹配 / 就近抵消 / 单调栈找下一个更大 |
| 6 | 堆 | Top-K / 第 K 大 / 动态取最值 / 多路归并 |
| 7 | 二分查找 | 有序 or 答案单调 → 找边界/找值 |
| 8 | 链表 | 指针操作,dummy 头 + 快慢指针 |
| 9 | 二叉树递归 | 树 + 「每个节点算一个值往上返」 |
| 10 | BFS 层序 | 最短层数 / 逐层处理 / 多源扩散 |
| 11 | 回溯 | 求「所有」排列/组合/子集/路径 |
| 12 | 网格搜索 | 二维矩阵连通块 / flood fill |
| 13 | 图(拓扑+并查集) | 依赖顺序 / 连通性合并 |
| 14 | 贪心 | 每步取局部最优、无需回头 |
| 15 | 线性 DP | 序列上「最优/计数」,当前只依赖前几项 |
| 16 | 背包 DP | 选或不选、凑目标、容量限制 |
| 17 | 二维/字符串 DP | 两个序列比对 / 网格路径 / 区间 |
| 18 | 设计题 | 要你实现一个类 + O(1) 操作 |

---

## 1. 哈希表(Hash Map / Set)

**识别信号**
- 「是否出现过」「有没有重复」「两个凑成 target」「按 key 分组」「统计频次」。
- 需要把 O(n²) 的「两两查找」降成 O(n)。

**为什么**
用空间换时间:哈希把「查找某个值是否存在/它的下标」从 O(n) 降到 O(1),边遍历边把已见过的存进去,当前元素只需回头查一次。

**解题步骤**

1. 想清楚 key 是什么(值本身?值→下标?排序后的字符串?)。     
2. 一次遍历:先查「我需要的搭档在不在表里」,再把「自己」放进表。
3. 查在前、存在后,避免自己和自己配对。

**Python 模板**

```python
def two_sum(nums, target):
    seen = {}                     # 值 -> 下标
    for i, x in enumerate(nums):
        if target - x in seen:    # 先查搭档
            return [seen[target - x], i]
        seen[x] = i               # 再存自己
    return []

# 分组:key = 排序后的字符 / 字符计数
from collections import defaultdict
def group_anagrams(strs):
    groups = defaultdict(list)
    for s in strs:
        groups[tuple(sorted(s))].append(s)
    return list(groups.values())

# 最长连续序列:只从「段的起点」开始数
def longest_consecutive(nums):
    s = set(nums)
    best = 0
    for x in s:
        if x - 1 not in s:            # x 是某段起点才展开
            y = x
            while y + 1 in s:
                y += 1
            best = max(best, y - x + 1)
    return best
```

**ACM 模板**
```python
import sys
def main():
    data = sys.stdin.read().split()
    n = int(data[0])
    nums = list(map(int, data[1:1 + n]))
    target = int(data[1 + n])
    seen = {}
    for i, x in enumerate(nums):
        if target - x in seen:
            print(seen[target - x], i)
            return
        seen[x] = i
    print(-1)
main()
```

**复杂度**:时间 O(n),空间 O(n)。

**Hot100 对应题(按难度)**
- 🟢 1. 两数之和
- 🟡 49. 字母异位词分组
- 🟡 128. 最长连续序列(注意去重 + 只从起点展开,才是 O(n))

**常见坑**
- 先存后查会把自己配进去;顺序必须「查→存」。
- 128 若对每个数都 while,会退化成 O(n²);必须判断 `x-1 not in s`。
- key 用可变对象(list)会报错,分组要用 `tuple`/字符串。

**口诀**:*先查搭档再存己,出现过没用哈希。*

---

## 2. 双指针(Two Pointers)

**识别信号**
- 数组/字符串「有序」或「可排序」,要找一对/一组满足和的元素 → **对撞指针**。
- 「原地」移动、去重、覆盖、快慢分离 → **快慢指针**。
- 关键词:两数之和(有序)、三数之和、盛水、接雨水、移动零、颜色分类。

**为什么**
有序性让你「看和的大小就知道该动哪头」:和大了右指针左移,和小了左指针右移,一次遍历省掉一层循环。快慢指针则用一个慢指针维护「已处理好的边界」。

**解题步骤(对撞)**
1. 排序(若未排序且题目允许)。
2. `l=0, r=n-1`,循环 `while l < r`。
3. 根据 `nums[l]+nums[r]` 与 target 比较移动指针;命中后**跳过重复**。

**Python 模板**
```python
# 对撞:三数之和
def three_sum(nums):
    nums.sort()
    n, res = len(nums), []
    for i in range(n):
        if nums[i] > 0:
            break
        if i > 0 and nums[i] == nums[i - 1]:
            continue                       # 跳过重复的枚举位
        l, r = i + 1, n - 1
        while l < r:
            s = nums[i] + nums[l] + nums[r]
            if s < 0:
                l += 1
            elif s > 0:
                r -= 1
            else:
                res.append([nums[i], nums[l], nums[r]])
                l += 1; r -= 1
                while l < r and nums[l] == nums[l - 1]:
                    l += 1                 # 跳重
                while l < r and nums[r] == nums[r + 1]:
                    r -= 1
    return res

# 快慢:原地移动零
def move_zeroes(nums):
    slow = 0
    for fast in range(len(nums)):
        if nums[fast] != 0:
            nums[slow], nums[fast] = nums[fast], nums[slow]
            slow += 1

# 对撞:接雨水(左右各维护一个最大值)
def trap(height):
    l, r = 0, len(height) - 1
    lm = rm = water = 0
    while l < r:
        if height[l] < height[r]:
            lm = max(lm, height[l]); water += lm - height[l]; l += 1
        else:
            rm = max(rm, height[r]); water += rm - height[r]; r -= 1
    return water
```

**ACM 模板**
```python
import sys
def main():
    data = sys.stdin.read().split()
    n = int(data[0])
    nums = list(map(int, data[1:1 + n]))
    nums.sort()
    res = []
    for i in range(n):
        if nums[i] > 0: break
        if i > 0 and nums[i] == nums[i - 1]: continue
        l, r = i + 1, n - 1
        while l < r:
            s = nums[i] + nums[l] + nums[r]
            if s < 0: l += 1
            elif s > 0: r -= 1
            else:
                res.append((nums[i], nums[l], nums[r]))
                l += 1; r -= 1
                while l < r and nums[l] == nums[l - 1]: l += 1
                while l < r and nums[r] == nums[r + 1]: r -= 1
    for a, b, c in res:
        print(a, b, c)
main()
```

**复杂度**:排序 O(n log n),双指针扫描 O(n)(三数之和整体 O(n²));空间 O(1)(不计排序)。

**Hot100 对应题(按难度)**
- 🟢 283. 移动零
- 🟡 11. 盛最多水的容器
- 🟡 15. 三数之和
- 🔴 42. 接雨水

**常见坑**
- 三数之和忘记「枚举位」和「双指针两侧」都要去重,会出重复解。
- 盛水移动的是**较矮**的那根(移高的不可能变大)。
- 快慢指针交换后 slow 只在放置有效元素时才 +1。

**口诀**:*有序找对头尾夹,原地整理快慢挪。*

---

## 3. 滑动窗口(Sliding Window)

**识别信号**
- 「**连续**子串 / 子数组」+「最长 / 最短 / 定长 / 恰好满足某条件」。
- 涉及「无重复」「包含所有字符」「和 ≥ / ≤ 某值」「异位词」。

**为什么**
窗口的「可行性」随右端扩张单调变差、随左端收缩单调变好,于是右指针只进不退、左指针只进不退,每个元素进出各一次 → O(n),省掉枚举所有子区间的 O(n²)。

**解题步骤**
1. 右指针 `right` 遍历,把新元素纳入窗口(更新计数)。
2. `while 窗口不合法`:收缩左边界 `left`,弹出元素。
3. 在合法处更新答案(最长在收缩后更新,最短在收缩时更新)。

**Python 模板**
```python
# 最长:无重复字符的最长子串
def length_of_longest_substring(s):
    last = {}            # 字符 -> 最近下标
    left = best = 0
    for right, c in enumerate(s):
        if c in last and last[c] >= left:
            left = last[c] + 1      # 跳到重复字符的右边
        last[c] = right
        best = max(best, right - left + 1)
    return best

# 定长 + 计数:找所有字母异位词起始下标
from collections import Counter
def find_anagrams(s, p):
    if len(p) > len(s):
        return []
    need = Counter(p)
    win = Counter(s[:len(p)])
    res = [0] if win == need else []
    for right in range(len(p), len(s)):
        win[s[right]] += 1
        left_ch = s[right - len(p)]
        win[left_ch] -= 1
        if win[left_ch] == 0:
            del win[left_ch]        # 保持 Counter 干净才能 == 比较
        if win == need:
            res.append(right - len(p) + 1)
    return res
```

**ACM 模板**
```python
import sys
def main():
    s = sys.stdin.readline().strip()
    last = {}
    left = best = 0
    for right, c in enumerate(s):
        if c in last and last[c] >= left:
            left = last[c] + 1
        last[c] = right
        best = max(best, right - left + 1)
    print(best)
main()
```

**复杂度**:时间 O(n),空间 O(字符集) 或 O(k)。

**Hot100 对应题(按难度)**
- 🟡 3. 无重复字符的最长子串
- 🟡 438. 找到字符串中所有字母异位词
- 🔴 76. 最小覆盖子串(变长窗口 + need 计数 + `valid` 计满足个数)

**常见坑**
- 「连续」才用窗口;不连续(可跳)是 DP/子序列问题。
- 定长窗口先移入右、再移出左,顺序别乱。
- Counter 比较相等时要删掉计数为 0 的键。

**口诀**:*连续子串求极值,右扩左缩一遍过。*

---

## 4. 前缀和(Prefix Sum)

**识别信号**
- 「子数组的和 / 差 等于 k」「区间和被反复查询」「和为 k 的个数」。
- 有负数,不能用滑动窗口时(窗口不单调)。

**为什么**
`sum(i..j) = pre[j] - pre[i-1]`。求「区间和 = k」等价于「找 `pre[j]-k` 是否作为某个 `pre[i-1]` 出现过」,配合哈希把两层枚举降到一层。

**解题步骤**
1. 维护累计和 `s`。
2. 用哈希记录「每个前缀和出现的次数」,**初始放 `{0:1}`**(空前缀)。
3. 每步先查 `s-k` 的出现次数累加进答案,再把 `s` 记入。

**Python 模板**
```python
from collections import defaultdict
def subarray_sum(nums, k):
    prefix = defaultdict(int)
    prefix[0] = 1            # 关键:空前缀
    s = count = 0
    for x in nums:
        s += x
        count += prefix[s - k]   # 先查
        prefix[s] += 1           # 后记
    return count
```

**ACM 模板**
```python
import sys
from collections import defaultdict
def main():
    data = sys.stdin.read().split()
    n, k = int(data[0]), int(data[-1])
    nums = list(map(int, data[1:1 + n]))
    prefix = defaultdict(int); prefix[0] = 1
    s = count = 0
    for x in nums:
        s += x
        count += prefix[s - k]
        prefix[s] += 1
    print(count)
main()
```

**复杂度**:时间 O(n),空间 O(n)。

**Hot100 对应题(按难度)**
- 🟡 560. 和为 K 的子数组
- 🟡 238. 除自身以外数组的乘积(前缀积 × 后缀积,思想同源)

**常见坑**
- 忘记 `prefix[0]=1`,会漏掉「从头开始的子数组」。
- 有负数时**不能**用滑动窗口,必须前缀和 + 哈希。
- 求个数是「累加次数」,不是「置 1」。

**口诀**:*区间和差查哈希,前缀零一先垫底。*

---

## 5. 栈(括号匹配 / 单调栈)

**识别信号**
- 「括号是否合法」「就近抵消 / 嵌套解码」→ **普通栈**。
- 「找每个元素**右边/左边第一个更大/更小**」「柱状图最大矩形」「每日温度」→ **单调栈**。

**为什么**
栈的 LIFO 天然匹配「最近未处理」的语义:括号要和最近的左括号配对;单调栈维护一个「还在等待更大/更小值」的候选序列,新元素来了就把被它「终结」的元素一次性弹出结算。

**解题步骤(单调栈)**
1. 决定栈里存**下标**还是值(通常存下标好算距离/宽度)。
2. 决定单调方向:找更大 → 维护**递减**栈;找更小 → 维护**递增**栈。
3. 新元素破坏单调性时,`while` 弹栈并结算被弹元素的答案,再入栈。

**Python 模板**
```python
# 普通栈:有效括号
def is_valid(s):
    stack = []
    pairs = {')': '(', ']': '[', '}': '{'}
    for c in s:
        if c in pairs:
            if not stack or stack.pop() != pairs[c]:
                return False
        else:
            stack.append(c)
    return not stack

# 单调栈:每日温度(找右边第一个更高)
def daily_temperatures(temps):
    n = len(temps)
    res = [0] * n
    stack = []                        # 存下标,温度递减
    for i, t in enumerate(temps):
        while stack and temps[stack[-1]] < t:
            j = stack.pop()
            res[j] = i - j
        stack.append(i)
    return res

# 单调栈:柱状图中最大的矩形
def largest_rectangle(heights):
    heights = heights + [0]           # 哨兵,收尾清算
    stack = [-1]                      # 哨兵左界
    best = 0
    for i, h in enumerate(heights):
        while stack[-1] != -1 and heights[stack[-1]] >= h:
            height = heights[stack.pop()]
            width = i - stack[-1] - 1
            best = max(best, height * width)
        stack.append(i)
    return best
```

**ACM 模板**
```python
import sys
def main():
    s = sys.stdin.readline().strip()
    stack = []
    pairs = {')': '(', ']': '[', '}': '{'}
    ok = True
    for c in s:
        if c in pairs:
            if not stack or stack.pop() != pairs[c]:
                ok = False; break
        else:
            stack.append(c)
    print("true" if ok and not stack else "false")
main()
```

**复杂度**:时间 O(n)(每个元素进出栈各一次),空间 O(n)。

**Hot100 对应题(按难度)**
- 🟢 20. 有效的括号
- 🟡 155. 最小栈(辅助栈同步存当前最小)
- 🟡 394. 字符串解码(数字栈 + 字符串栈)
- 🟡 739. 每日温度(单调栈入门)
- 🔴 84. 柱状图中最大的矩形(单调栈 + 宽度计算)

**常见坑**
- 括号:结束时栈必须为空(只判成对不够)。
- 单调栈的「≥ 还是 >」影响相等元素处理,84 用 `>=` 避免重复统计。
- 忘记加哨兵会漏掉「栈中残留元素」的结算。

**口诀**:*就近匹配用栈弹,找大找小单调栈。*

---

## 6. 堆 / 优先队列(Heap)

**识别信号**
- 「第 K 大 / 第 K 小」「前 K 高频」「Top-K」「动态维护最值 / 中位数」「合并 K 个有序」。
- 只关心「最值」,不需要整体有序。

**为什么**
堆用 O(log n) 维护「当前最值」,比全排序 O(n log n) 更省;求第 K 大只需一个大小为 K 的小顶堆(堆顶即答案),空间 O(K)。

**解题步骤(第 K 大)**
1. 维护大小为 K 的**小顶堆**。
2. 遍历入堆,超过 K 就弹堆顶(弹掉的是当前最小)。
3. 堆顶就是第 K 大。(Python `heapq` 是小顶堆;要大顶堆就存相反数)

**Python 模板**
```python
import heapq
# 第 K 大:小顶堆保留最大的 K 个
def find_kth_largest(nums, k):
    heap = []
    for x in nums:
        heapq.heappush(heap, x)
        if len(heap) > k:
            heapq.heappop(heap)
    return heap[0]

# 前 K 高频
from collections import Counter
def top_k_frequent(nums, k):
    cnt = Counter(nums)
    return heapq.nlargest(k, cnt.keys(), key=cnt.get)

# 数据流中位数:大顶堆(左半,存负数) + 小顶堆(右半)
class MedianFinder:
    def __init__(self):
        self.lo = []   # 大顶堆(取负)
        self.hi = []   # 小顶堆
    def addNum(self, num):
        heapq.heappush(self.lo, -num)
        heapq.heappush(self.hi, -heapq.heappop(self.lo))
        if len(self.hi) > len(self.lo):
            heapq.heappush(self.lo, -heapq.heappop(self.hi))
    def findMedian(self):
        if len(self.lo) > len(self.hi):
            return -self.lo[0]
        return (-self.lo[0] + self.hi[0]) / 2
```

**ACM 模板**
```python
import sys, heapq
def main():
    data = sys.stdin.read().split()
    n, k = int(data[0]), int(data[-1])
    nums = list(map(int, data[1:1 + n]))
    heap = []
    for x in nums:
        heapq.heappush(heap, x)
        if len(heap) > k:
            heapq.heappop(heap)
    print(heap[0])
main()
```

**复杂度**:第 K 大 O(n log k);建堆 O(n);全排序对比 O(n log n)。

**Hot100 对应题(按难度)**
- 🟡 215. 数组中的第 K 个最大元素
- 🟡 347. 前 K 个高频元素
- 🔴 295. 数据流的中位数(对顶堆)

**常见坑**
- Python `heapq` 只有小顶堆,求大顶堆存 `-x` 或用元组。
- 求第 K **大**用**小**顶堆(反直觉),别记反。
- 对顶堆要始终保持两堆大小差 ≤ 1。

**口诀**:*Top-K 别全排,小顶堆里留 K 个。*

---

## 7. 二分查找(Binary Search)

**识别信号**
- 数组**有序**要找值 / 找边界。
- 「旋转有序」「找第一个/最后一个满足条件的位置」「答案存在单调性(可二分答案)」。

**为什么**
单调性让你每次比较排除一半,O(n)→O(log n)。难点不在思路而在**边界**:统一用「循环不变量」写法就不会死循环。

**解题步骤(找左边界,推荐主模板)**
1. `lo, hi = 0, n`(左闭右开);循环 `while lo < hi`。
2. `mid = (lo+hi)//2`;若 `check(mid)` 为「太小/不满足」则 `lo=mid+1`,否则 `hi=mid`。
3. 结束时 `lo` 即第一个满足条件的位置。

**Python 模板**
```python
# 找左边界(lower_bound):第一个 >= target 的下标
def lower_bound(nums, target):
    lo, hi = 0, len(nums)
    while lo < hi:
        mid = (lo + hi) // 2
        if nums[mid] < target:
            lo = mid + 1
        else:
            hi = mid
    return lo                    # 可能等于 len(nums)

# 搜索旋转排序数组
def search_rotated(nums, target):
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if nums[mid] == target:
            return mid
        if nums[lo] <= nums[mid]:          # 左半有序
            if nums[lo] <= target < nums[mid]:
                hi = mid - 1
            else:
                lo = mid + 1
        else:                              # 右半有序
            if nums[mid] < target <= nums[hi]:
                lo = mid + 1
            else:
                hi = mid - 1
    return -1
```

**ACM 模板**
```python
import sys, bisect
def main():
    data = sys.stdin.read().split()
    n, target = int(data[0]), int(data[-1])
    nums = list(map(int, data[1:1 + n]))
    i = bisect.bisect_left(nums, target)   # 直接用标准库最稳
    print(i if i < n and nums[i] == target else -1)
main()
```

**复杂度**:时间 O(log n),空间 O(1)。

**Hot100 对应题(按难度)**
- 🟢 35. 搜索插入位置
- 🟡 74. 搜索二维矩阵(把矩阵拉平成一维)
- 🟡 34. 在排序数组中查找元素的第一个和最后一个位置
- 🟡 33. 搜索旋转排序数组
- 🟡 153. 寻找旋转排序数组中的最小值
- 🔴 4. 寻找两个正序数组的中位数(二分第 k 小 / 划分)

**常见坑**
- `while lo < hi` 配 `hi=mid`;`while lo <= hi` 配 `hi=mid-1`,别混。
- 旋转数组先判「哪半有序」,再判 target 是否落在有序半区间。
- 能用 `bisect` 就用,自己写容易差 1。

**口诀**:*有序或答案单调,循环不变定边界。*

---

## 8. 链表(Linked List)

**识别信号**
- 题目给的是 `ListNode`;要反转、合并、找环、找中点、删倒数第 K、两两交换。

**为什么**
链表不能随机访问,靠**指针腾挪**。两大神器:**dummy 虚拟头**(统一处理头节点删除/插入)、**快慢指针**(找中点、找环、找倒数第 K)。

**解题步骤(通法)**
1. 需要可能改动头节点?→ 建 `dummy = ListNode(next=head)`。
2. 反转类:`prev/cur/nxt` 三指针逐个翻。
3. 找中点/环:`slow` 走一步,`fast` 走两步。

**Python 模板**
```python
class ListNode:
    def __init__(self, val=0, nxt=None):
        self.val = val
        self.next = nxt

# 反转链表
def reverse_list(head):
    prev, cur = None, head
    while cur:
        cur.next, prev, cur = prev, cur, cur.next
    return prev

# 快慢指针判环(141) + 找入口(142)
def detect_cycle(head):
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
        if slow is fast:                 # 相遇
            p = head
            while p is not slow:
                p = p.next; slow = slow.next
            return p                      # 环入口
    return None

# dummy 头:合并两个有序链表
def merge_two(l1, l2):
    dummy = tail = ListNode()
    while l1 and l2:
        if l1.val <= l2.val:
            tail.next, l1 = l1, l1.next
        else:
            tail.next, l2 = l2, l2.next
        tail = tail.next
    tail.next = l1 or l2
    return dummy.next
```

**四道高频指针题(19 / 24 / 25 / 138)独立写法**
```python
# 19 删除倒数第 N 个:快指针先走 N 步,再快慢同步,slow 停在「待删前驱」
def remove_nth_from_end(head, n):
    dummy = ListNode(0, head)
    fast = slow = dummy
    for _ in range(n): fast = fast.next
    while fast.next:
        fast = fast.next; slow = slow.next
    slow.next = slow.next.next
    return dummy.next

# 24 两两交换:dummy + 每轮调整相邻两节点
def swap_pairs(head):
    dummy = ListNode(0, head); prev = dummy
    while prev.next and prev.next.next:
        a, b = prev.next, prev.next.next
        a.next = b.next; b.next = a; prev.next = b   # 交换 a、b
        prev = a
    return dummy.next

# 25 K 个一组翻转(Hard):够 K 个才翻,组间接续
def reverse_k_group(head, k):
    dummy = ListNode(0, head); group_prev = dummy
    while True:
        kth = group_prev
        for _ in range(k):                   # 先数够 K 个吗
            kth = kth.next
            if not kth: return dummy.next     # 不足 K 个,收工
        group_next = kth.next
        prev, cur = group_next, group_prev.next
        while cur != group_next:              # 翻转本组
            cur.next, prev, cur = prev, cur, cur.next
        tmp = group_prev.next                 # 原组头变组尾
        group_prev.next = kth; group_prev = tmp

# 138 随机链表复制:哈希「旧节点 -> 新节点」,两遍
def copy_random_list(head):
    if not head: return None
    mp = {}
    cur = head
    while cur: mp[cur] = Node(cur.val); cur = cur.next   # 一遍:建所有新点
    cur = head
    while cur:                                           # 二遍:接 next / random
        mp[cur].next = mp.get(cur.next)
        mp[cur].random = mp.get(cur.random)
        cur = cur.next
    return mp[head]
```

**ACM 模板**
```python
import sys
class ListNode:
    def __init__(self, val=0, nxt=None):
        self.val = val; self.next = nxt

def build(arr):
    dummy = tail = ListNode()
    for v in arr:
        tail.next = ListNode(v); tail = tail.next
    return dummy.next

def dump(head):
    out = []
    while head:
        out.append(str(head.val)); head = head.next
    print(" ".join(out) if out else "empty")

def main():
    arr = list(map(int, sys.stdin.readline().split()))
    head = build(arr)
    prev, cur = None, head            # 反转示例
    while cur:
        cur.next, prev, cur = prev, cur, cur.next
    dump(prev)
main()
```

**复杂度**:多数 O(n) 时间、O(1) 空间(排序链表 148 是 O(n log n))。

**Hot100 对应题(按难度)**
- 🟢 160. 相交链表 / 🟢 206. 反转链表 / 🟢 234. 回文链表 / 🟢 141. 环形链表 / 🟢 21. 合并两个有序链表
- 🟡 142. 环形链表 II / 🟡 2. 两数相加 / 🟡 19. 删除倒数第 N 个 / 🟡 24. 两两交换 / 🟡 138. 随机链表复制 / 🟡 148. 排序链表
- 🔴 25. K 个一组翻转 / 🔴 23. 合并 K 个升序链表(配合堆)

**常见坑**
- 改 `next` 前先用临时变量存住后继,否则丢链。
- 快慢指针循环条件 `fast and fast.next`,顺序不能反(短路防空指针)。
- 涉及删/换头节点一律上 dummy,少写一堆特判。

**口诀**:*虚拟头稳边界,快慢指针找环中。*

---

## 9. 二叉树递归(Tree DFS / 分治)

**识别信号**
- 给的是 `TreeNode`;问深度、直径、对称、翻转、路径和、校验 BST、构造树、最近公共祖先。

**为什么**
树是递归定义的,「解决整棵树 = 解决左子树 + 解决右子树 + 当前节点合并」。核心是想清楚**递归函数返回什么**、以及**用不用全局变量记答案**。

**解题步骤**
1. 定义 `dfs(node)` 的**返回值语义**(如「以我为根的最大深度/最大链」)。
2. 写 base case:`if not node: return 空值`。
3. 递归左右,合并;若答案是「跨越节点的量」(直径、最大路径和),用外部变量在合并处更新。

**Python 模板**
```python
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val; self.left = left; self.right = right

# 通法:返回值 + 全局答案(直径 543 / 最大路径和 124 同构)
def diameter(root):
    best = 0
    def depth(node):
        nonlocal best
        if not node:
            return 0
        l = depth(node.left)
        r = depth(node.right)
        best = max(best, l + r)          # 经过 node 的路径
        return 1 + max(l, r)             # 返回给父亲的「链长」
    depth(root)
    return best

# 校验 BST:用上下界约束
def is_valid_bst(root):
    def check(node, lo, hi):
        if not node:
            return True
        if not (lo < node.val < hi):
            return False
        return check(node.left, lo, node.val) and check(node.right, node.val, hi)
    return check(root, float('-inf'), float('inf'))

# 最近公共祖先(236)
def lowest_common_ancestor(root, p, q):
    if not root or root is p or root is q:
        return root
    l = lowest_common_ancestor(root.left, p, q)
    r = lowest_common_ancestor(root.right, p, q)
    if l and r:
        return root        # p、q 分居两侧
    return l or r
```

**树题分四类(命中模板 9 后先归类,再选打法)**

| 类型 | 特征 | 代表题 | 打法 |
|------|------|--------|------|
| 遍历型 | 按序访问/收集 | 94 中序 | 递归三行 或 迭代用栈 |
| 分治型 | 每点算值往上返 | 104/543/124/236 | 返回值 + 全局更新(上面模板) |
| 构造型 | 由序列造树 | 105/108/114 | 自顶向下:定根 → 分左右区间 |
| 路径型 | 统计路径和/数 | 437 | 树上前缀和 或 双递归 |
| BST 型 | 用有序性 | 98/230 | **中序 = 升序** 是关键 |

**遍历型:递归三序 + 迭代中序**
```python
def inorder(root):                       # 递归:换 append 的位置即前/中/后序
    res = []
    def dfs(node):
        if not node: return
        dfs(node.left); res.append(node.val); dfs(node.right)
    dfs(root); return res

def inorder_iter(root):                   # 迭代中序:栈 + 一路向左
    res, stack, cur = [], [], root
    while stack or cur:
        while cur:
            stack.append(cur); cur = cur.left
        cur = stack.pop()
        res.append(cur.val)
        cur = cur.right
    return res
```

**构造型:105 前序+中序建树 / 108 有序数组转 BST / 114 展开为链表**
```python
def build_tree(preorder, inorder):        # 105:前序定根,中序分左右
    idx = {v: i for i, v in enumerate(inorder)}
    pos = 0
    def helper(lo, hi):
        nonlocal pos
        if lo > hi: return None
        root = TreeNode(preorder[pos]); pos += 1     # 前序当前个是根
        mid = idx[root.val]                          # 中序里根的位置
        root.left = helper(lo, mid - 1)
        root.right = helper(mid + 1, hi)
        return root
    return helper(0, len(inorder) - 1)

def sorted_array_to_bst(nums):            # 108:取中点当根,天然平衡
    def build(lo, hi):
        if lo > hi: return None
        mid = (lo + hi) // 2
        node = TreeNode(nums[mid])
        node.left = build(lo, mid - 1)
        node.right = build(mid + 1, hi)
        return node
    return build(0, len(nums) - 1)

def flatten(root):                        # 114:原地 O(1) 展开成右链
    cur = root
    while cur:
        if cur.left:
            pre = cur.left
            while pre.right: pre = pre.right    # 找左子树最右下
            pre.right = cur.right               # 接上原右子树
            cur.right, cur.left = cur.left, None
        cur = cur.right
```

**路径型:437 路径总和 III(树上前缀和 = 把模板 4 搬上树)**
```python
from collections import defaultdict
def path_sum(root, target):
    prefix = defaultdict(int); prefix[0] = 1     # 根前的空前缀
    res = 0
    def dfs(node, cur):
        nonlocal res
        if not node: return
        cur += node.val
        res += prefix[cur - target]     # 多少个祖先前缀使这段和 = target
        prefix[cur] += 1
        dfs(node.left, cur); dfs(node.right, cur)
        prefix[cur] -= 1                # 回溯:离开本节点撤销
    dfs(root, 0)
    return res
```

**BST 型 & 对称型:230 第 K 小 / 101 对称**
```python
def kth_smallest(root, k):                # 230:BST 中序的第 k 个即答案
    stack, cur = [], root
    while stack or cur:
        while cur: stack.append(cur); cur = cur.left
        cur = stack.pop(); k -= 1
        if k == 0: return cur.val
        cur = cur.right

def is_symmetric(root):                   # 101:双节点同步递归(a.left ↔ b.right)
    def check(a, b):
        if not a and not b: return True
        if not a or not b: return False
        return a.val == b.val and check(a.left, b.right) and check(a.right, b.left)
    return check(root, root) if root else True
```

**ACM 模板**(层序建树,`#` 表示空)
```python
import sys
from collections import deque
class TreeNode:
    def __init__(self, v):
        self.val = v; self.left = self.right = None

def build(tokens):
    if not tokens or tokens[0] == '#':
        return None
    it = iter(tokens)
    root = TreeNode(int(next(it)))
    q = deque([root])
    while q:                             # 不能用 for 遍历 deque 边 append(会 RuntimeError)
        node = q.popleft()
        for side in ('left', 'right'):
            t = next(it, '#')
            if t != '#':
                child = TreeNode(int(t))
                setattr(node, side, child)
                q.append(child)
    return root

def max_depth(node):
    return 0 if not node else 1 + max(max_depth(node.left), max_depth(node.right))

def main():
    tokens = sys.stdin.readline().split()
    print(max_depth(build(tokens)))
main()
```

**复杂度**:一般 O(n) 时间;空间 O(h)(递归栈,h 为树高,最坏 O(n))。

**Hot100 对应题(按难度)**
- 🟢 94/104/226/101/543/108(遍历、深度、翻转、对称、直径、有序数组转 BST)
- 🟡 102(层序,见模板10)/98/230/199/114/105/437/236
- 🔴 124. 二叉树中的最大路径和(直径的加权版)

**常见坑**
- 直径 / 最大路径和:返回给父亲的是「单边链」,更新答案用「左+右」,两者别写成一样。
- 校验 BST 要传上下界,只比父子不够(要全局有序)。
- 递归深度大时注意栈溢出(可 `sys.setrecursionlimit`)。

**口诀**:*想清返回值,左右合并再更新全局。*

---

## 10. BFS 层序遍历(Breadth-First Search)

**识别信号**
- 「按层处理」「每一层的最右/最大」「最短路径 / 最少步数(边权为 1)」「多源同时扩散」。
- 树的层序、网格的最短路、腐烂橘子。

**为什么**
BFS 按「距离起点的层数」一圈圈扩展,第一次到达某点即最短(边权为 1)。用队列 `deque`,配合「一次处理一整层」的写法拿到层信息。

**解题步骤**
1. 起点(可多个)入队;visited 标记防重复。
2. `while 队列非空`:记录 `size=len(q)`,循环 `size` 次弹出当前层。
3. 把邻居入队;层数 / 答案在每层结束时更新。

**Python 模板**
```python
from collections import deque
# 树的层序遍历(102)
def level_order(root):
    if not root:
        return []
    res, q = [], deque([root])
    while q:
        level = []
        for _ in range(len(q)):          # 锁定当前层大小
            node = q.popleft()
            level.append(node.val)
            if node.left:  q.append(node.left)
            if node.right: q.append(node.right)
        res.append(level)
    return res

# 多源 BFS:腐烂橘子(994)
def oranges_rotting(grid):
    m, n = len(grid), len(grid[0])
    q = deque()
    fresh = 0
    for i in range(m):
        for j in range(n):
            if grid[i][j] == 2: q.append((i, j))
            elif grid[i][j] == 1: fresh += 1
    minutes = 0
    while q and fresh:
        minutes += 1
        for _ in range(len(q)):
            i, j = q.popleft()
            for di, dj in ((1,0),(-1,0),(0,1),(0,-1)):
                x, y = i + di, j + dj
                if 0 <= x < m and 0 <= y < n and grid[x][y] == 1:
                    grid[x][y] = 2; fresh -= 1; q.append((x, y))
    return -1 if fresh else minutes
```

**ACM 模板**
```python
import sys
from collections import deque
def main():
    data = sys.stdin.read().split()
    m, n = int(data[0]), int(data[1])
    vals = list(map(int, data[2:2 + m * n]))
    grid = [vals[i*n:(i+1)*n] for i in range(m)]
    q = deque(); fresh = 0
    for i in range(m):
        for j in range(n):
            if grid[i][j] == 2: q.append((i, j))
            elif grid[i][j] == 1: fresh += 1
    minutes = 0
    while q and fresh:
        minutes += 1
        for _ in range(len(q)):
            i, j = q.popleft()
            for di, dj in ((1,0),(-1,0),(0,1),(0,-1)):
                x, y = i+di, j+dj
                if 0 <= x < m and 0 <= y < n and grid[x][y] == 1:
                    grid[x][y] = 2; fresh -= 1; q.append((x, y))
    print(-1 if fresh else minutes)
main()
```

**复杂度**:时间 O(点+边)= 树 O(n) / 网格 O(mn);空间 O(宽度)。

**Hot100 对应题(按难度)**
- 🟡 102. 二叉树的层序遍历
- 🟡 199. 二叉树的右视图(每层最后一个)
- 🟡 994. 腐烂的橘子(多源 BFS 求时间)
- 🟡 200. 岛屿数量(也可 BFS,见模板12)

**常见坑**
- 求最短路一定用 BFS,不是 DFS(DFS 找到的不保证最短)。
- 一定在**入队时**标记 visited,不是出队时(否则同一点重复入队爆队列)。
- 「按层」必须先存 `len(q)` 再循环,循环里 q 会变长。

**口诀**:*最短层序用队列,入队即标记锁层数。*

---

## 11. 回溯(Backtracking / DFS 枚举)

**识别信号**
- 求「**所有**」方案:全排列、组合、子集、括号、切割、路径、N 皇后。
- 答案是「一棵决策树的所有叶子」。

**为什么**
回溯 = DFS 遍历决策树 + 撤销选择。每层做一个选择,递归到底收集一个解,返回时**撤销**(恢复现场)以尝试下一个分支。

**解题步骤**
1. 明确「路径 path」「选择列表」「结束条件」。
2. `for 每个选择`:剪枝 → 做选择(入 path)→ 递归 → **撤销**(出 path)。
3. 组合/子集用 `start` 防重复选;排列用 `used[]` 标记。

**Python 模板**
```python
# 全排列(46):用 used
def permute(nums):
    res, path, used = [], [], [False]*len(nums)
    def bt():
        if len(path) == len(nums):
            res.append(path[:]); return
        for i in range(len(nums)):
            if used[i]:
                continue
            used[i] = True; path.append(nums[i])
            bt()
            path.pop(); used[i] = False
    bt()
    return res

# 子集(78):每个节点都是解,用 start
def subsets(nums):
    res, path = [], []
    def bt(start):
        res.append(path[:])
        for i in range(start, len(nums)):
            path.append(nums[i])
            bt(i + 1)
            path.pop()
    bt(0)
    return res

# 组合总和(39):可重复选 → 递归传 i 而非 i+1
def combination_sum(candidates, target):
    res, path = [], []
    candidates.sort()
    def bt(start, remain):
        if remain == 0:
            res.append(path[:]); return
        for i in range(start, len(candidates)):
            if candidates[i] > remain:      # 排序后剪枝
                break
            path.append(candidates[i])
            bt(i, remain - candidates[i])   # i 允许重复用
            path.pop()
    bt(0, target)
    return res
```

**补:17 电话号码——第三种回溯骨架(index 型)**

排列用 `used`、组合/子集用 `start`,而 17 是「**每个位置各选一个**」,用 **index 推进**:
```python
def letter_combinations(digits):          # 17
    if not digits: return []
    mp = {'2':'abc','3':'def','4':'ghi','5':'jkl',
          '6':'mno','7':'pqrs','8':'tuv','9':'wxyz'}
    res, path = [], []
    def bt(i):
        if i == len(digits):              # 每位都选完了
            res.append(''.join(path)); return
        for ch in mp[digits[i]]:          # 枚举当前数字对应的字母
            path.append(ch); bt(i + 1); path.pop()
    bt(0)
    return res
```

**ACM 模板**
```python
import sys
def main():
    nums = list(map(int, sys.stdin.readline().split()))
    res, path, used = [], [], [False]*len(nums)
    def bt():
        if len(path) == len(nums):
            res.append(path[:]); return
        for i in range(len(nums)):
            if used[i]: continue
            used[i] = True; path.append(nums[i])
            bt()
            path.pop(); used[i] = False
    bt()
    for p in res:
        print(*p)
main()
```

**复杂度**:指数级。排列 O(n·n!),子集 O(n·2ⁿ),组合视剪枝而定。

**Hot100 对应题(按难度)**
- 🟡 46. 全排列 / 🟡 78. 子集 / 🟡 17. 电话号码字母组合 / 🟡 39. 组合总和 / 🟡 22. 括号生成 / 🟡 79. 单词搜索 / 🟡 131. 分割回文串
- 🔴 51. N 皇后

**常见坑**
- 收集解要 `path[:]` 拷贝,直接存 `path` 会被后续修改。
- 组合/子集去重靠 `start`,排列去重靠 `used`;含重复元素还要「同层跳重」`if i>start and a[i]==a[i-1]: continue`。
- 「做选择」和「撤销选择」必须对称成对。

**口诀**:*选择递归再撤销,组合 start 排列 used。*

---

## 12. 网格搜索(Flood Fill / 岛屿类)

**识别信号**
- 二维矩阵求「连通块个数 / 面积 / 边界」「把一片区域染色」「单词在网格里的路径」。

**为什么**
把网格看成图,每格是点、上下左右是边。DFS/BFS 从一个点出发吃掉整片连通区域;为了不重复访问,**访问即改标记**(原地改成 0 或另开 visited)。

**解题步骤**
1. 双重循环找到没访问过的「陆地」。
2. 从它出发 DFS/BFS,沿途标记为已访问,吃掉整块。
3. 每启动一次 DFS 计数 +1(或累计面积)。

**Python 模板**
```python
# 岛屿数量(200)
def num_islands(grid):
    if not grid: return 0
    m, n = len(grid), len(grid[0])
    def dfs(i, j):
        if i < 0 or i >= m or j < 0 or j >= n or grid[i][j] != '1':
            return
        grid[i][j] = '0'                 # 访问即沉岛,防重复
        dfs(i+1, j); dfs(i-1, j); dfs(i, j+1); dfs(i, j-1)
    count = 0
    for i in range(m):
        for j in range(n):
            if grid[i][j] == '1':
                count += 1; dfs(i, j)
    return count

# 单词搜索(79):带回溯的网格 DFS
def exist(board, word):
    m, n = len(board), len(board[0])
    def dfs(i, j, k):
        if k == len(word):
            return True
        if i < 0 or i >= m or j < 0 or j >= n or board[i][j] != word[k]:
            return False
        board[i][j] = '#'                # 占用
        found = (dfs(i+1,j,k+1) or dfs(i-1,j,k+1) or
                 dfs(i,j+1,k+1) or dfs(i,j-1,k+1))
        board[i][j] = word[k]            # 回溯恢复
        return found
    return any(dfs(i, j, 0) for i in range(m) for j in range(n))
```

**ACM 模板**
```python
import sys
def main():
    data = sys.stdin.read().split('\n')
    m, n = map(int, data[0].split())
    grid = [list(data[1 + i]) for i in range(m)]
    def dfs(i, j):
        if i < 0 or i >= m or j < 0 or j >= n or grid[i][j] != '1':
            return
        grid[i][j] = '0'
        dfs(i+1,j); dfs(i-1,j); dfs(i,j+1); dfs(i,j-1)
    count = 0
    for i in range(m):
        for j in range(n):
            if grid[i][j] == '1':
                count += 1; dfs(i, j)
    print(count)
main()
```

**复杂度**:时间 O(m·n),空间 O(m·n)(递归栈/队列最坏)。

**Hot100 对应题(按难度)**
- 🟡 200. 岛屿数量
- 🟡 79. 单词搜索(网格 DFS + 回溯)
- 🟡 994. 腐烂的橘子(网格 + 多源 BFS,见模板10)

**常见坑**
- 单词搜索必须回溯恢复格子(同一格不能重复用,但换条路要能再用)。
- 岛屿数量沉岛后不用恢复(每格只算一次)。
- 四方向数组 `((1,0),(-1,0),(0,1),(0,-1))` 统一管理,少写错。

**口诀**:*连通块起一次 DFS,访问即标记吃整片。*

---

## 13. 图:拓扑排序 + 并查集

**识别信号**
- 「课程依赖 / 任务先后 / 能否完成 / 排出顺序」→ **拓扑排序**(有向无环)。
- 「连通性合并 / 有几个连通分量 / 两点是否相连 / 判成环(无向)」→ **并查集**。

**为什么**
- 拓扑:不断取出「入度为 0(无前置依赖)」的点,BFS(Kahn 算法)排序;若最终排不完,说明有环。
- 并查集:用「父指针 + 路径压缩」把「谁和谁在一组」压成近 O(1) 的查询/合并。

**解题步骤(拓扑)**
1. 建邻接表 + 统计每个点入度。
2. 入度为 0 的全入队;弹出一个就把它的后继入度 -1,减到 0 再入队。
3. 出队计数 == 点数 → 无环/可完成。

**Python 模板**
```python
from collections import deque
# 拓扑排序:课程表(207)
def can_finish(num_courses, prerequisites):
    graph = [[] for _ in range(num_courses)]
    indeg = [0] * num_courses
    for a, b in prerequisites:            # 修 a 前要先修 b
        graph[b].append(a)
        indeg[a] += 1
    q = deque([i for i in range(num_courses) if indeg[i] == 0])
    seen = 0
    while q:
        node = q.popleft(); seen += 1
        for nxt in graph[node]:
            indeg[nxt] -= 1
            if indeg[nxt] == 0:
                q.append(nxt)
    return seen == num_courses

# 并查集模板
class DSU:
    def __init__(self, n):
        self.p = list(range(n))
        self.cnt = n                      # 连通分量数
    def find(self, x):
        while self.p[x] != x:
            self.p[x] = self.p[self.p[x]] # 路径压缩
            x = self.p[x]
        return x
    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.p[ra] = rb; self.cnt -= 1
```

**ACM 模板**
```python
import sys
from collections import deque
def main():
    data = sys.stdin.read().split()
    idx = 0
    n = int(data[idx]); idx += 1          # 课程数
    m = int(data[idx]); idx += 1          # 依赖数
    graph = [[] for _ in range(n)]
    indeg = [0]*n
    for _ in range(m):
        a, b = int(data[idx]), int(data[idx+1]); idx += 2
        graph[b].append(a); indeg[a] += 1
    q = deque([i for i in range(n) if indeg[i] == 0])
    order = []
    while q:
        u = q.popleft(); order.append(u)
        for v in graph[u]:
            indeg[v] -= 1
            if indeg[v] == 0: q.append(v)
    print(*order if len(order) == n else [-1])
main()
```

**复杂度**:拓扑 O(点+边);并查集近似 O(α(n))≈O(1) 每次操作。

**Hot100 对应题(按难度)**
- 🟡 207. 课程表(拓扑排序判环)
- 🟡 200. 岛屿数量(也可用并查集数连通分量)

**常见坑**
- 建图方向别反:「a 依赖 b」是 `b → a`,入度加在 a 上。
- 判环:拓扑排序排不完(`seen < n`)即有环。
- 并查集别忘路径压缩,否则退化成链 O(n)。

**口诀**:*依赖入度零先出,连通合并并查集。*

---

## 14. 贪心(Greedy)

**识别信号**
- 「每一步取当前最优就能得全局最优」「跳跃能否到达 / 最少跳数」「区间划分 / 覆盖」「买卖股票一次」。
- 特征:不需要回头改之前的决策。

**为什么**
当问题具备「贪心选择性质 + 最优子结构」时,局部最优可拼成全局最优,省掉 DP 的状态表。难点是**证明贪心成立**(或凭直觉 + 反例验证)。

**解题步骤**
1. 找到「每一步该比较什么、取什么最优」。
2. 一次遍历维护一个「当前最优量」(最远可达、历史最低价、上一段右界)。
3. 边扫边更新答案。

**Python 模板**
```python
# 跳跃游戏(55):维护最远可达
def can_jump(nums):
    reach = 0
    for i, x in enumerate(nums):
        if i > reach:
            return False                 # 断层,到不了
        reach = max(reach, i + x)
    return True

# 跳跃游戏 II(45):贪心求最少步数
def jump(nums):
    steps = end = farthest = 0
    for i in range(len(nums) - 1):
        farthest = max(farthest, i + nums[i])
        if i == end:                     # 到达本步的边界,必须跳一次
            steps += 1; end = farthest
    return steps

# 买卖股票一次(121):维护历史最低价
def max_profit(prices):
    low, best = float('inf'), 0
    for p in prices:
        low = min(low, p)
        best = max(best, p - low)
    return best

# 划分字母区间(763):每个字母最后出现位置定右界
def partition_labels(s):
    last = {c: i for i, c in enumerate(s)}
    res, start, end = [], 0, 0
    for i, c in enumerate(s):
        end = max(end, last[c])
        if i == end:
            res.append(end - start + 1); start = i + 1
    return res
```

**ACM 模板**
```python
import sys
def main():
    prices = list(map(int, sys.stdin.readline().split()))
    low, best = float('inf'), 0
    for p in prices:
        low = min(low, p)
        best = max(best, p - low)
    print(best)
main()
```

**复杂度**:一般 O(n)(或排序 O(n log n)),空间 O(1)。

**Hot100 对应题(按难度)**
- 🟢 121. 买卖股票的最佳时机
- 🟡 55. 跳跃游戏
- 🟡 45. 跳跃游戏 II
- 🟡 763. 划分字母区间

**常见坑**
- 贪心要能举不出反例才敢用;拿不准就退回 DP。
- 跳跃 II 的 `for` 到 `n-1` 为止(到最后一格不用再跳)。
- 股票「一次」用贪心,「多次/含冷冻期/手续费」通常要 DP。

**口诀**:*每步局部最优解,一遍扫过不回头。*

---

## 15. 线性 DP(序列上的动态规划)

**识别信号**
- 「序列上求最优 / 计数 / 可行性」,且「当前状态只依赖前面几项」。
- 关键词:爬楼梯、打家劫舍、最大子数组和、最长递增子序列、乘积最大、单词拆分。

**为什么**
把「以 i 结尾/前 i 个」的子问题答案存进 `dp[i]`,后面的直接复用,避免指数级重算。核心三问:**状态定义、转移方程、初始/边界**。

**解题步骤**
1. 定义 `dp[i]` 是什么(常见:「以 i 结尾的最优」或「前 i 个的最优」)。
2. 写转移:`dp[i]` 由 `dp[i-1] / dp[i-2] / dp[j<i]` 推出。
3. 初始化 + 确定答案是 `dp[-1]` 还是 `max(dp)`。

**Python 模板**
```python
# 打家劫舍(198):dp[i]=偷到 i 的最大金额;滚动优化到 O(1)
def rob(nums):
    prev, cur = 0, 0
    for x in nums:
        prev, cur = cur, max(cur, prev + x)
    return cur

# 最大子数组和(53):dp=以 i 结尾的最大和(Kadane)
def max_sub_array(nums):
    cur = best = nums[0]
    for x in nums[1:]:
        cur = max(x, cur + x)            # 要么接上,要么重开
        best = max(best, cur)
    return best

# 最长递增子序列(300):O(n log n) 贪心 + 二分
import bisect
def length_of_lis(nums):
    tails = []
    for x in nums:
        i = bisect.bisect_left(tails, x)
        if i == len(tails):
            tails.append(x)
        else:
            tails[i] = x                 # 让相同长度的结尾尽量小
    return len(tails)
```

**ACM 模板**
```python
import sys
def main():
    nums = list(map(int, sys.stdin.readline().split()))
    cur = best = nums[0]
    for x in nums[1:]:
        cur = max(x, cur + x)
        best = max(best, cur)
    print(best)
main()
```

**复杂度**:多数 O(n) 或 O(n²);LIS 二分优化 O(n log n)。空间常可滚动到 O(1)。

**Hot100 对应题(按难度)**
- 🟢 70. 爬楼梯 / 🟢 118. 杨辉三角
- 🟡 198. 打家劫舍 / 🟡 53. 最大子数组和 / 🟡 300. 最长递增子序列 / 🟡 152. 乘积最大子数组 / 🟡 139. 单词拆分
- 🔴 32. 最长有效括号

**常见坑**
- 「以 i 结尾」和「前 i 个」是两种状态定义,转移和取答案方式不同。
- 乘积最大要同时维护 `max` 和 `min`(负负得正)。
- LIS 求「个数」用 O(n²) DP,求「长度」才可二分。

**口诀**:*状态转移边界,当前只看前几项。*

---

## 16. 背包 DP(选或不选 / 凑目标)

**识别信号**
- 「从一堆物品里选,能否凑出 / 凑满 target」「最少几个凑出金额」「装满有几种方案」。
- 0/1 背包:每个物品选一次(分割等和子集)。完全背包:物品无限次(零钱兑换、完全平方数)。

**为什么**
背包是线性 DP 的经典子类:`dp[c]` = 容量/目标为 c 时的最优解。用「一维滚动数组」把二维压扁,靠**遍历顺序**区分 0/1 与完全背包。

**解题步骤**
1. 定 `dp[c]`:凑出 c 的最少个数 / 能否凑出 / 方案数。
2. 外层遍历物品,内层遍历容量。
3. **0/1 背包内层倒序**(每物品用一次);**完全背包内层正序**(可重复用)。

**Python 模板**
```python
# 0/1 背包:分割等和子集(416)——能否凑出 sum/2
def can_partition(nums):
    total = sum(nums)
    if total % 2:
        return False
    target = total // 2
    dp = [False] * (target + 1)
    dp[0] = True
    for x in nums:                       # 先物品
        for c in range(target, x - 1, -1):   # 倒序:每个数只用一次
            dp[c] = dp[c] or dp[c - x]
    return dp[target]

# 完全背包:零钱兑换(322)——最少硬币数
def coin_change(coins, amount):
    INF = float('inf')
    dp = [0] + [INF] * amount
    for coin in coins:                   # 先物品
        for c in range(coin, amount + 1):    # 正序:硬币可重复用
            dp[c] = min(dp[c], dp[c - coin] + 1)
    return dp[amount] if dp[amount] != INF else -1

# 完全背包:完全平方数(279)——最少几个平方数凑 n
def num_squares(n):
    dp = [0] + [float('inf')] * n
    for i in range(1, int(n**0.5) + 1):
        for c in range(i*i, n + 1):
            dp[c] = min(dp[c], dp[c - i*i] + 1)
    return dp[n]
```

**ACM 模板**
```python
import sys
def main():
    data = sys.stdin.read().split()
    amount = int(data[0])
    coins = list(map(int, data[1:]))
    INF = float('inf')
    dp = [0] + [INF]*amount
    for coin in coins:
        for c in range(coin, amount+1):
            dp[c] = min(dp[c], dp[c-coin]+1)
    print(dp[amount] if dp[amount] != INF else -1)
main()
```

**复杂度**:时间 O(物品数 × 目标),空间 O(目标)。

**Hot100 对应题(按难度)**
- 🟡 322. 零钱兑换(完全背包·求最少)
- 🟡 279. 完全平方数(完全背包)
- 🟡 416. 分割等和子集(0/1 背包·可行性)
- 🟡 139. 单词拆分(可看成完全背包·可行性)

**常见坑**
- **0/1 倒序、完全正序**——这是背包最容易错的一点。
- 求「组合数」先物品后容量;求「排列数」先容量后物品(顺序敏感)。
- 初始化:求最少填 INF、`dp[0]=0`;求可行填 False、`dp[0]=True`。

**口诀**:*选与不选背包装,0/1 倒序完全正。*

---

## 17. 二维 / 字符串 DP(两序列比对 / 网格 / 区间)

**识别信号**
- 「两个字符串/序列比对」:编辑距离、最长公共子序列。
- 「网格从左上走到右下」:不同路径、最小路径和。
- 「回文 / 区间」:最长回文子串。

**为什么**
状态需要两个维度 `dp[i][j]`(走到网格 (i,j) / 匹配到 s1 前 i、s2 前 j)。转移通常来自左、上、左上三个方向,画个二维表逐格填。

**解题步骤**
1. 定 `dp[i][j]` 的含义(前 i 与前 j 的最优 / 走到 (i,j) 的最优)。
2. 找转移(匹配则来自左上 `dp[i-1][j-1]`,否则取相邻最优 +1)。
3. 初始化第 0 行第 0 列(空串 / 边界),按行填表。

**Python 模板**
```python
# 编辑距离(72)
def min_distance(w1, w2):
    m, n = len(w1), len(w2)
    dp = [[0]*(n+1) for _ in range(m+1)]
    for i in range(m+1): dp[i][0] = i        # 删光
    for j in range(n+1): dp[0][j] = j        # 全插
    for i in range(1, m+1):
        for j in range(1, n+1):
            if w1[i-1] == w2[j-1]:
                dp[i][j] = dp[i-1][j-1]       # 不用改
            else:
                dp[i][j] = 1 + min(dp[i-1][j],      # 删
                                   dp[i][j-1],      # 插
                                   dp[i-1][j-1])    # 换
    return dp[m][n]

# 最小路径和(64):滚动一维
def min_path_sum(grid):
    m, n = len(grid), len(grid[0])
    dp = [float('inf')] * n
    dp[0] = 0
    for i in range(m):
        for j in range(n):
            if j == 0:
                dp[j] += grid[i][j]
            else:
                dp[j] = min(dp[j], dp[j-1]) + grid[i][j]
    return dp[-1]

# 最长回文子串(5):中心扩展,O(n²) 但省空间
def longest_palindrome(s):
    def expand(l, r):
        while l >= 0 and r < len(s) and s[l] == s[r]:
            l -= 1; r += 1
        return s[l+1:r]
    best = ""
    for i in range(len(s)):
        for cand in (expand(i, i), expand(i, i+1)):   # 奇 / 偶中心
            if len(cand) > len(best):
                best = cand
    return best
```

**ACM 模板**
```python
import sys
def main():
    w1 = sys.stdin.readline().strip()
    w2 = sys.stdin.readline().strip()
    m, n = len(w1), len(w2)
    dp = [[0]*(n+1) for _ in range(m+1)]
    for i in range(m+1): dp[i][0] = i
    for j in range(n+1): dp[0][j] = j
    for i in range(1, m+1):
        for j in range(1, n+1):
            if w1[i-1] == w2[j-1]:
                dp[i][j] = dp[i-1][j-1]
            else:
                dp[i][j] = 1 + min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
    print(dp[m][n])
main()
```

**复杂度**:时间 O(m·n),空间 O(m·n)(常可滚动到 O(n))。

**Hot100 对应题(按难度)**
- 🟡 62. 不同路径 / 🟡 64. 最小路径和 / 🟡 5. 最长回文子串 / 🟡 1143. 最长公共子序列 / 🟡 72. 编辑距离

**常见坑**
- 下标错位:`dp[i][j]` 对应 `s[i-1]`、`t[j-1]`(多开一行一列表示空串)。
- 一定先把第 0 行/列的边界含义想清楚再填。
- 最长回文子串「子串」用中心扩展/区间 DP;「子序列」是另一道(区间 DP)。

**口诀**:*两串开表多一格,左上相邻定转移。*

---

## 18. 设计题(数据结构设计)

**识别信号**
- 「实现一个类,支持 O(1)/O(log n) 的若干操作」:LRU、最小栈、Trie、数据流中位数、前缀树。

**为什么**
考的是「用合适的数据结构组合达到目标复杂度」。常见套路:**哈希表 + 双向链表**(LRU 的 O(1))、**辅助栈**(最小栈)、**树/字典嵌套**(Trie)、**对顶堆**(中位数)。

**解题步骤**
1. 列出要支持的操作和目标复杂度。
2. 反推:哪种结构能让最贵的操作达标?(要 O(1) 增删又要有序→双向链表;要按前缀→Trie)
3. 组合结构,想清每个操作如何同步维护。

**Python 模板**
```python
# LRU 缓存(146):OrderedDict = 哈希 + 双向链表
from collections import OrderedDict
class LRUCache:
    def __init__(self, capacity):
        self.cache = OrderedDict()
        self.cap = capacity
    def get(self, key):
        if key not in self.cache:
            return -1
        self.cache.move_to_end(key)          # 变最近使用
        return self.cache[key]
    def put(self, key, value):
        if key in self.cache:
            self.cache.move_to_end(key)
        self.cache[key] = value
        if len(self.cache) > self.cap:
            self.cache.popitem(last=False)   # 淘汰最久未用

# 前缀树 Trie(208)
class Trie:
    def __init__(self):
        self.root = {}
    def insert(self, word):
        node = self.root
        for c in word:
            node = node.setdefault(c, {})
        node['#'] = True                     # 结束标记
    def _find(self, prefix):
        node = self.root
        for c in prefix:
            if c not in node:
                return None
            node = node[c]
        return node
    def search(self, word):
        node = self._find(word)
        return node is not None and '#' in node
    def startsWith(self, prefix):
        return self._find(prefix) is not None

# 最小栈(155):辅助栈同步存「当前最小」
class MinStack:
    def __init__(self):
        self.stack = []
        self.mins = []
    def push(self, x):
        self.stack.append(x)
        self.mins.append(x if not self.mins else min(x, self.mins[-1]))
    def pop(self):
        self.stack.pop(); self.mins.pop()
    def top(self):
        return self.stack[-1]
    def getMin(self):
        return self.mins[-1]
```

**ACM 模板**(按操作序列驱动)
```python
import sys
from collections import OrderedDict
def main():
    data = sys.stdin.read().split('\n')
    cap = int(data[0])
    cache = OrderedDict()
    for line in data[1:]:
        if not line.strip():
            continue
        parts = line.split()
        if parts[0] == 'get':
            k = int(parts[1])
            if k in cache:
                cache.move_to_end(k); print(cache[k])
            else:
                print(-1)
        elif parts[0] == 'put':
            k, v = int(parts[1]), int(parts[2])
            if k in cache: cache.move_to_end(k)
            cache[k] = v
            if len(cache) > cap: cache.popitem(last=False)
main()
```

**复杂度**:LRU get/put O(1);Trie 每操作 O(词长);最小栈全 O(1)。

**Hot100 对应题(按难度)**
- 🟡 155. 最小栈 / 🟡 146. LRU 缓存 / 🟡 208. 实现 Trie / 🟡 208 类前缀应用
- 🔴 295. 数据流的中位数(对顶堆,见模板6)

**常见坑**
- LRU 手写双向链表要维护好 `prev/next` 和 dummy 头尾;偷懒就用 `OrderedDict`。
- Trie 一定要有「单词结束标记」,否则 `search` 和 `startsWith` 分不清。
- 最小栈的辅助栈要和主栈**同步 push/pop**。

**口诀**:*哈希配链表 O(1),按操作选结构。*

---

# 📚 代码案例题解索引

> 本索引按上文代码出现顺序补全“题目描述 + 题目解析”。同一算法的 ACM 块仅改变输入输出形式，除非特别说明，题意与解析和对应 Python 函数相同。

## 1. 哈希表

- **1. 两数之和**：给定数组和目标值，返回和为目标值的两个不同下标。遍历时以哈希表保存已见的“值→下标”，先查补数 `target-x` 再记录 `x`，既避免自配又只扫描一次；时间、空间均为 O(n)。ACM 块是本题的读入输出版本。
- **49. 字母异位词分组**：把由相同字母组成的字符串分到同一组。排序后的字符序列是稳定分组键，故用其作为哈希键聚合原串；设平均串长为 k，时间 O(nk log k)，空间 O(nk)。
- **128. 最长连续序列**：求无序数组中最长的数值连续段长度。将数字放进集合，仅当 `x-1` 不存在时从 `x` 向右扩展，每段不会被重复展开；期望时间 O(n)，空间 O(n)。

## 2. 双指针

- **15. 三数之和**：找出所有和为 0 且不重复的三元组。排序后枚举第一个数，在右侧以对撞指针按和的大小移动，并跳过三处重复值；时间 O(n²)，额外空间 O(1)（不计排序和答案）。ACM 块是本题的输出版本。
- **283. 移动零**：原地将所有 0 移到末尾且保持非零元素相对顺序。快指针扫描，慢指针指向下一个非零值的落位处，遇到非零值就交换并推进慢指针；时间 O(n)，空间 O(1)。
- **42. 接雨水**：计算柱状图能接住的雨水量。维护左右两侧最高柱，较低侧当前位置的水位已确定，因此结算后移动该侧；时间 O(n)，空间 O(1)。

## 3. 滑动窗口

- **3. 无重复字符的最长子串**：求不含重复字符的最长连续子串长度。记录字符最近下标，右端扩展时若字符仍在窗口内，就将左端直接跳到其上次出现位置之后；双指针均只前进，时间 O(n)，空间 O(|Σ|)。
- **438. 找到字符串中所有字母异位词**：返回 `s` 中与 `p` 互为异位词的定长子串起点。维护长度为 `len(p)` 的频次窗口，每次加入右字符、移出左字符，计数相等即记录；固定小写字母表时为 O(n) 时间、O(|Σ|) 空间。

## 4. 前缀和

- **560. 和为 K 的子数组**：统计和为 `k` 的连续子数组数。当前前缀和为 `s` 时，之前每个 `s-k` 都对应一个合法子数组；哈希表存前缀和频次并以 `{0: 1}` 初始化空前缀；时间、空间均为 O(n)。ACM 块为同题输入输出版本。

## 5. 栈

- **20. 有效的括号**：判断括号字符串是否正确闭合。左括号入栈，右括号必须匹配栈顶；中途不匹配或结束后仍有左括号即无效；时间、空间均为 O(n)。
- **739. 每日温度**：对每一天求首次出现更高温度所需天数。维护温度单调不增的下标栈，当前温度更高时不断弹栈并用下标差结算；每个下标进出各一次，时间、空间均为 O(n)。
- **84. 柱状图中最大的矩形**：求柱状图可形成的最大矩形面积。递增下标栈保证栈内柱子尚未遇到右侧更矮柱；遇到更矮高度时弹栈，以当前下标和新栈顶确定宽度，尾部哨兵负责清算；时间、空间均为 O(n)。ACM 块为本题版本。

## 6. 堆 / 优先队列

- **215. 数组中的第 K 个最大元素**：返回排序后第 k 大元素（不是第 k 个不同值）。用大小至多为 k 的小顶堆保留最大 k 个数，堆顶即答案；时间 O(n log k)，空间 O(k)。
- **347. 前 K 个高频元素**：返回出现频率最高的 k 个元素。先哈希计数，再按频次取 Top-K；设不同元素数为 m，时间 O(n + m log k)，空间 O(m)。
- **295. 数据流的中位数**：设计支持插入和查询中位数的结构。大顶堆存较小半边、小顶堆存较大半边，并维持前者数量最多只多一个；插入 O(log n)、查询 O(1)、空间 O(n)。ACM 块使用同一对顶堆不变量。

## 7. 二分查找

- **35. 搜索插入位置**：在严格升序数组中返回目标下标，若不存在则返回其有序插入位置。用左闭右开区间找第一个 `>= target` 的位置；时间 O(log n)，空间 O(1)。ACM 块展示该 `lower_bound` 的调用。
- **33. 搜索旋转排序数组**：在无重复的旋转升序数组中查找目标。每轮先判断哪一侧仍有序，再检查目标是否落在该有序区间，从而排除另一半；时间 O(log n)，空间 O(1)。

## 8. 链表

- **206. 反转链表**：原地反转单链表并返回新头。迭代维护 `prev`、`cur`，改写 `next` 前先保存后继；时间 O(n)，空间 O(1)。ACM 块为同题版本。
- **141/142. 环形链表 / 环形链表 II**：判断是否有环，并在有环时返回入口。快慢指针相遇证明有环；一指针回到头部后与另一指针同速前进，再次相遇即入口；时间 O(n)，空间 O(1)。
- **21. 合并两个有序链表**：合并两条非递减链表。虚拟头和尾指针每次接入两表当前较小节点，最后接上剩余部分；时间 O(m+n)，额外空间 O(1)。
- **19. 删除链表的倒数第 N 个结点**：删除倒数第 n 个节点。借助虚拟头让快指针先走 n 步，再与慢指针同步，快指针到尾时慢指针恰在待删节点前；时间 O(n)，空间 O(1)。
- **24. 两两交换链表中的节点**：每两个相邻节点交换，末尾单节点不动。虚拟头统一边界，每轮重连前驱、两节点和后继后，将前驱移至本组尾；时间 O(n)，空间 O(1)。
- **25. K 个一组翻转链表**：每 k 个节点翻转一次，不足 k 个保持原样。先探测本组是否够 k 个，确认后反转并把新组首尾接回前后链段；时间 O(n)，空间 O(1)。
- **138. 随机链表的复制**：深拷贝带 `next` 和 `random` 指针的链表。第一遍建立旧节点到新节点的映射，第二遍按映射连接两个指针；时间、空间均为 O(n)。

## 9. 二叉树递归 / 分治

- **543. 二叉树的直径**：求任意两节点间最长路径的边数。后序 DFS 返回向下最长单链，节点左右深度之和用于更新全局直径；时间 O(n)，递归空间 O(h)。同一“返回值 + 全局更新”结构也适用于 **124. 二叉树中的最大路径和**，只需改为丢弃负贡献并以节点值加左右贡献更新答案。
- **98. 验证二叉搜索树**：判断树是否满足全局 BST 约束。递归向下传递开区间 `(lo, hi)`，左树收紧上界、右树抬高下界；时间 O(n)，空间 O(h)。
- **236. 二叉树的最近公共祖先**：在普通二叉树中找两个节点的最近公共祖先。左右递归结果都非空则当前节点为答案，否则向上返回非空结果；时间 O(n)，空间 O(h)。
- **94. 二叉树的中序遍历**：按左、根、右顺序返回节点值。递归直接按顺序访问；迭代版以栈压入整条左链，弹出访问后转向右子树；时间 O(n)，空间 O(h)。
- **105. 从前序与中序遍历序列构造二叉树**：由无重复的两种遍历重建树。前序当前位置给根，中序索引表 O(1) 划分左右区间，再递归构造；时间、空间均为 O(n)。
- **108. 将有序数组转换为二叉搜索树**：把升序数组转换为高度平衡 BST。每个区间取中点为根，递归处理左右半区；时间 O(n)，递归空间 O(log n)（不计输出树）。
- **114. 二叉树展开为链表**：按前序将树原地展开为仅含右指针的链。若有左树，找到其最右节点并接上原右树，再把左树移到右侧；时间 O(n)，额外空间 O(1)。
- **437. 路径总和 III**：统计和为目标值的向下路径数。DFS 维护根到当前节点的前缀和频次，`cur-target` 的出现次数就是新增路径，回溯时撤销当前和；时间 O(n)，空间 O(h)。
- **230. 二叉搜索树中第 K 小的元素**：返回 BST 中第 k 小值。中序遍历天然升序，迭代弹栈第 k 次即答案；时间 O(h+k)（最坏 O(n)），空间 O(h)。
- **101. 对称二叉树**：判断左右子树是否镜像。同步比较镜像节点值，并递归比较交叉子树；时间 O(n)，空间 O(h)。
- **104. 二叉树的最大深度**：ACM 建树块中的案例，求根到最深叶子的节点数。空树为 0，非空树取左右最大深度加 1；时间 O(n)，空间 O(h)。

## 10. BFS 层序遍历

- **102. 二叉树的层序遍历**：逐层返回节点值。队列保存待处理节点，每轮固定当前队列长度以界定一层，并将子节点入队；时间 O(n)，空间 O(w)，w 为最大层宽。
- **994. 腐烂的橘子**：求所有新鲜橘子腐烂的最少分钟数，不可能则返回 -1。所有初始腐烂橘子同时入队做多源 BFS，逐层感染并记录剩余新鲜数；时间、空间均为 O(mn)。ACM 块为同题版本。

## 11. 回溯

- **46. 全排列**：返回无重复数组的全部排列。`used` 标记当前路径已选元素，选一个、递归、撤销一个，长度为 n 时收集答案；时间 O(n·n!)，辅助空间 O(n)。ACM 块为同题版本。
- **78. 子集**：返回所有子集（含空集）。搜索树每个节点都是一个合法答案，`start` 只允许向后选数，从而避免同一集合以不同顺序重复；时间 O(n·2ⁿ)，辅助空间 O(n)。
- **39. 组合总和**：从候选数选取若干个使和为目标，元素可复用。排序后以剩余值剪枝，递归仍传 `i` 允许重复选当前数，传 `i+1` 才会禁止复用；时间指数级，递归空间 O(target/min(candidate))。
- **17. 电话号码的字母组合**：返回数字串 2–9 对应的所有字母组合。递归层数对应数字位置，每层枚举按键字母并回溯；设长度为 d，时间 O(d·4^d)，辅助空间 O(d)。

## 12. 网格搜索

- **200. 岛屿数量**：统计四方向连通陆地块数。遍历网格，遇到未访问陆地便计数并 DFS 将整个连通块标记为水，保证不重复计数；时间 O(mn)，最坏递归空间 O(mn)。ACM 块为同题版本。
- **79. 单词搜索**：判断单词能否由相邻格依次组成且格子不可重复。每个格子作为起点 DFS，匹配后临时标记访问，探索四邻并在返回时恢复现场；设词长 L，时间上界 O(mn·4^L)，空间 O(L)。

## 13. 图：拓扑排序 + 并查集

- **207. 课程表**：给定先修关系，判断能否修完所有课程。建图并统计入度，从所有入度为 0 的点开始 Kahn BFS；最终出队数量等于课程数说明无环；时间、空间均为 O(V+E)。ACM 块输出可行顺序，因而也可直接对应 **210. 课程表 II**。
- **通用并查集模板**：维护动态连通分量，支持合并与查询。父指针树的 `find` 使用路径压缩，`union` 合并两个根并减少分量数；摊还近 O(α(n)) 每次操作，空间 O(n)。

## 14. 贪心

- **55. 跳跃游戏**：判断能否到达数组末尾。扫描中维护最远可达位置，若当前位置超过它则失败，否则用 `i+nums[i]` 扩展；时间 O(n)，空间 O(1)。
- **45. 跳跃游戏 II**：求到达末尾的最少跳数（题目保证可达）。把一次跳跃的覆盖范围看作一层，扫描到当前层边界时跳一次并把边界扩至下一层最远点；时间 O(n)，空间 O(1)。
- **121. 买卖股票的最佳时机**：只允许一次买卖，求最大利润。维护此前最低价格，并以当天卖出时的差值更新最优利润；时间 O(n)，空间 O(1)。ACM 块为同题版本。
- **763. 划分字母区间**：尽可能多地切分字符串，使每个字母只属于一个片段。先记录每个字符最后位置，扫描时扩展当前片段右界，走到右界即可切分；时间 O(n)，空间 O(|Σ|)。

## 15. 线性 DP

- **198. 打家劫舍**：相邻房屋不能同偷，求最大金额。当前位置取“不偷时沿用前项”和“偷时前前项加当前值”的较大者，滚动保存两项即可；时间 O(n)，空间 O(1)。
- **53. 最大子数组和**：求和最大的非空连续子数组。以当前位置结尾的最优和只需比较“从当前重新开始”和“接到此前子数组后面”，即 Kadane 转移；时间 O(n)，空间 O(1)。ACM 块为同题版本。
- **300. 最长递增子序列**：求严格递增子序列最大长度。`tails[k]` 保存长度 k+1 子序列的最小结尾，每个数用二分替换首个不小于它的位置或追加；`tails` 长度即答案，时间 O(n log n)，空间 O(n)。

## 16. 背包 DP

- **416. 分割等和子集**：判断数组能否拆为和相等的两个子集。总和为偶数时转为“每个数最多取一次，能否凑出总和一半”，容量必须倒序以防重复使用；设目标 T，时间 O(nT)，空间 O(T)。
- **322. 零钱兑换**：硬币可无限使用，求凑出金额的最少硬币数。`dp[c]` 记凑出 c 的最少数量，按硬币正序更新容量使其可复用，无法到达则返回 -1；时间 O(kA)，空间 O(A)。ACM 块为同题版本。
- **279. 完全平方数**：求和为 n 的最少完全平方数数量。将每个平方数作为可重复物品，使用与零钱兑换相同的完全背包转移；时间 O(n√n)，空间 O(n)。

## 17. 二维 / 字符串 DP

- **72. 编辑距离**：求把一个字符串变成另一个的最少插入、删除、替换次数。`dp[i][j]` 比较两个前缀，末字符相同继承左上，否则在删、插、换的相邻状态中取最小加一；时间、空间均为 O(mn)。ACM 块为同题版本。
- **64. 最小路径和**：只能向右或向下走，求网格最小路径和。一维 `dp[j]` 更新前代表上方、`dp[j-1]` 代表左方，取较小者加当前格；时间 O(mn)，空间 O(n)。
- **5. 最长回文子串**：返回最长回文连续子串。分别枚举奇数和偶数中心，向两边扩展至不匹配并维护最长区间；时间 O(n²)，核心辅助空间 O(1)。

## 18. 设计题

- **146. LRU 缓存**：设计固定容量缓存，`get`、`put` 均要求平均 O(1)，满时淘汰最久未使用项。`OrderedDict` 将哈希查找和使用顺序结合，访问/写入后移动至末尾，超限删除开头；空间 O(capacity)。ACM 块为同题版本。
- **208. 实现 Trie（前缀树）**：支持插入单词、查询完整单词和查询前缀。嵌套字典表示字符路径，末尾结束标记区分完整词与普通前缀；设字符串长 L，三种操作均为 O(L)，空间与已建节点数成正比。
- **155. 最小栈**：除常规栈操作外以 O(1) 返回最小元素。主栈存值，辅助栈在每次压栈时同步存当前最小值，出栈也同步弹出；所有操作 O(1)，空间 O(n)。

---

# 🧭 算法模板决策术(看题 → 定模板)

> 拿到题先别写代码。先写清对象、操作、目标、约束、最小充分状态和不变量，再把下面的结构当作**候选算法族**；不能仅凭关键词“先命中先用”。真实笔试的完整流程见[《大厂笔试模式识别与组合题决策树》](/blog/exam-pattern-decision-tree/)。

## 第 0 步:看「输入的数据结构」——只生成候选,不是结论

| 输入长这样 | 大概率是 | 模板 |
|-----------|---------|------|
| `ListNode` 链表 | 指针操作 | **8 链表** |
| `TreeNode` 树 | 递归 / 层序 | **9 树递归 / 10 BFS** |
| 二维网格 `grid[][]` | 连通/路径/区域查询/坐标变换/数值矩阵 | **12 网格 / 17 二维DP / 10 BFS / 二维前缀** |
| 图 / `边 [a,b]` / 依赖 | 连通/最短路/拓扑/DAG DP/MST/匹配 | **13 图 + 进阶决策树** |
| 要你「实现一个类」 | 数据结构设计 | **18 设计题** |

> **树题再细分**(命中模板 9 后按此二次定位):问深度/直径/路径和 → 分治返回值;问由序列**构造**树 → 自顶向下定根(105/108);问**路径计数** → 树上前缀和(437);问 BST 第 K/校验 → **中序 = 升序**(230/98);问**展开/翻转** → 前驱指针或直接递归(114/226)。

## 第 1 步:看「问什么」——定大方向

```
问「所有方案 / 全部排列组合子集路径」?
   ├─ 要输出具体方案 → 【11 回溯】(网格上的就是 12)
   └─ 只计数/最优且子问题重复 → DP; n≈35~45 的子集问题考虑 MITM

问「最短 / 最少步数 / 最少几步到」?
   ├─ 边权全 1 → 【10 BFS】
   ├─ 边权 0/1 → 0-1 BFS
   ├─ 非负权 → Dijkstra
   └─ 有限步/中转或负权 → 分层 Bellman-Ford/DP
   注意:位置相同但剩余资源/步数/mask 不同时,搜索状态和 visited 都必须扩维。

问「最优值(最大/最小)或方案数」,且不要求列出方案?
   ├─ 每步贪心不回头能证明最优? → 【14 贪心】
   └─ 否则 → DP:
        ├─ 一个序列,当前只依赖前几项 → 【15 线性 DP】
        ├─ 选物品凑目标/容量 → 【16 背包 DP】
        └─ 两个序列 / 网格 / 区间 → 【17 二维 DP】

问「存在性 / 计数 / 分组 / 去重」?
   ├─ key 可直接表示等价类/补数/频次 → 【1 哈希表】
   └─ 路径/方案/区间/动态排名计数 → DP / 前缀结构 / Fenwick,不能只凭“计数”选哈希

问「第 K 大 / Top-K / 动态最值 / 中位数」?
   ├─ 在线插入并反复取极值 → 【6 堆】
   ├─ 静态只求第 K → 排序或 quickselect
   └─ 动态排名/频繁区间统计 → Fenwick/有序结构
```

## 第 2 步:看「数组/字符串的性质」——定具体技巧

```
数组「有序」或「答案单调」?
   ├─ 找值 / 找边界 → 【7 二分查找】
   └─ 找一对/一组和 → 【2 双指针·对撞】

要「原地」移动/去重/覆盖/分区(颜色分类)?
   └─→ 【2 双指针·快慢】

求「连续子串/子数组」?
   ├─ 长度固定 → 滚动和/固定窗口
   ├─ 右扩只变坏、左缩只变好 → 【3 可伸缩滑动窗口】
   ├─ 求「和=k 的个数」 → 【4 前缀和 + 哈希】
   ├─ 最大连续和 → Kadane
   └─ 前缀极值约束 → 单调队列

「就近匹配 / 括号 / 嵌套解码」?
   └─→ 【5 栈】

「找每个元素右边(左边)第一个更大/更小」?
   └─→ 【5 单调栈】
```

## 第 3 步:还没命中?用这些「兜底/组合」提示

- **组合题按流水线拆**:变换→Kadane;二维前缀→枚举;排序→DP;事件逆序→DSU;建图→拓扑/DAG DP。每阶段分别写输入、输出与复杂度。
- **暴力能过就先暴力**,再看状态总量而不只看单个 n:
  - n ≤ 20 → 允许指数级 → 回溯 / 状压。
  - n ≈ 35~45 → 子集折半 → MITM。
  - n ≤ 2000 → O(n²) 能过 → 二维 DP / 朴素双层。
  - n ≤ 1e5 → 需要 O(n) 或 O(n log n) → 哈希/窗口/双指针/二分/堆。
  - n ≥ 1e6 → 基本只能 O(n) → 哈希/前缀和/贪心。
- **先定映射等级**:原题级 / 同构 / 技术部件 / 组合题 / 无精确 LC。只有前两类适合直接迁移代码。
- **候选算法验伪**:单调性成立吗?状态丢信息吗?贪心有交换论证/领先性吗?能否用 n≤8 暴力对拍?
- 仍未命中时转到[进阶决策树](/blog/exam-pattern-decision-tree/),不要为了套题强行分配 LeetCode 题号。

## 决策一图流(文字版流程图)

```
拿到题
 │
 ├─ 先写对象/操作/目标/约束/状态/不变量
 │
 ├─ 输出所有具体方案? ───────────── 是 → 回溯(11)/网格(12)
 │
 ├─ 要最短路? ─────────────────── 按边权与步数限制选 BFS/0-1 BFS/Dijkstra/分层BF
 │
 ├─ 要最优/计数? ───────────────── 贪心必须能证明;否则 DP/图搜索
 │
 ├─ 有序 or 答案单调? ───────────── 是 → 二分(7)/对撞双指针(2)
 │
 ├─ 连续区间? ─────────────────── 定长/单调窗口/前缀和/Kadane/单调队列再分流
 │
 ├─ 图/网格? ─────────────────── 连通/最短路/依赖/MST/树DAG DP再分流
 │
 ├─ 动态区间或排名? ─────────────── Fenwick/线段树/有序结构
 │
 └─ 复杂规则或模型数值题? ───────── 状态机或 ML/AI Coding 补丁;停止硬套 Hot100
```

---

# 📊 复杂度速查 & 数据范围反推

| 数据范围 n | 可接受复杂度 | 典型模板 |
|-----------|-------------|---------|
| ≤ 12 | O(n!) | 全排列回溯 |
| ≤ 20 | O(2ⁿ) | 子集/状压 |
| ≤ 500 | O(n³) | 区间 DP |
| ≤ 2000 | O(n²) | 二维 DP、朴素双指针(Python 保守取 n≤2000~3000)|
| ≤ 1e5 | O(n log n) | 排序、二分、堆、分治 |
| ≤ 1e6 | O(n) | 哈希、窗口、前缀和、贪心 |
| ≥ 1e9 | O(log n) / O(1) | 二分答案、数学 |

---

# 🗺️ Hot100 建议刷题顺序(由易到难,按模板成组攻)

1. **入门打底**:哈希(1,49,128)→ 双指针(283,11,15)→ 滑窗(3,438)→ 前缀和(560,238)。
2. **链表专题**:206→21→141→142→19→24→2→148→23→146。
3. **树专题**:104→226→101→94→102→98→230→236→105→124。
4. **搜索专题**:回溯(78→46→39→22→79→131→51)→ 网格(200→994→79)。
5. **二分 & 栈 & 堆**:35→34→33→153→4;20→739→84;215→347→295。
6. **DP 专题**(压轴):70→198→53→300→322→416→62→64→5→1143→72→32→152→139。
7. **图 & 设计**:207;208→155→146。

> 每组先照着上面的模板默写一遍,再做 2~3 题变体;能独立复现「模板 + 一句话口诀」就算过关。

---

# 🎯 18 口诀速记(考前扫一眼)

1. 哈希:先查搭档再存己,出现过没用哈希。
2. 双指针:有序找对头尾夹,原地整理快慢挪。
3. 滑窗:连续子串求极值,右扩左缩一遍过。
4. 前缀和:区间和差查哈希,前缀零一先垫底。
5. 栈:就近匹配用栈弹,找大找小单调栈。
6. 堆:Top-K 别全排,小顶堆里留 K 个。
7. 二分:有序或答案单调,循环不变定边界。
8. 链表:虚拟头稳边界,快慢指针找环中。
9. 树:想清返回值,左右合并再更新全局。
10. BFS:最短层序用队列,入队即标记锁层数。
11. 回溯:选择递归再撤销,组合 start 排列 used。
12. 网格:连通块起一次 DFS,访问即标记吃整片。
13. 图:依赖入度零先出,连通合并并查集。
14. 贪心:每步局部最优解,一遍扫过不回头。
15. 线性 DP:状态转移边界,当前只看前几项。
16. 背包:选与不选背包装,0/1 倒序完全正。
17. 二维 DP:两串开表多一格,左上相邻定转移。
18. 设计:哈希配链表 O(1),按操作选结构。
