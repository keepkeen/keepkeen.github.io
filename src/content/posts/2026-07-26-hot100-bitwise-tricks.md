---
title: "LeetCode Hot100 补充篇：位运算、数学与杂项技巧（模板 19–27）"
description: "Hot100 里不属于 18 大主模板、但有固定套路的技巧题：位运算、数学与杂项，方法很短但想不到就是想不到，靠见过并记住套路拿分。"
date: 2026-07-26
tags:
  - algorithms
  - leetcode
  - interview
featured: false
draft: false
lang: zh-CN
series: llm-algo-job-hunt
seriesOrder: 6
---

> 本文是个人求职工作区文档的发布版，最后核验 2026-07-26。文档源文件与可运行模板、测试托管在 GitHub 仓库 [llm-algo-job-notes](https://github.com/keepkeen/llm-algo-job-notes)；文中所有面经均为公开帖子的转述，证据分级见正文说明。

> 这是《18 大算法模板与决策术》的姊妹篇。收录 Hot100 里**不属于那 18 个主模板、但有固定套路**的「技巧题」。
> 这类题的共性:**方法很短,但想不到就是想不到**——所以要靠「见过 + 记住套路」而不是现场推导。
> 格式沿用 9 件套:识别信号 / 为什么 / 解题步骤 / Python 模板 / ACM 模板 / 复杂度 / Hot100 对应题 / 常见坑 / 一句话口诀。

## 技巧篇总览

| # | 技巧 | 一句话触发条件 | 对应题 |
|---|------|----------------|--------|
| 19 | 位运算·异或 | 「除一个外都成对」找那个单的 | 136 |
| 20 | 摩尔投票 | 找「出现次数过半」的元素,O(1) 空间 | 169 |
| 21 | 荷兰国旗 | 「只有 3 种值」原地排序/三分区 | 75 |
| 22 | 原地哈希 | 值域是 [1,n],用「下标当桶」找缺失/重复 | 41 |
| 23 | 快慢指针·数组版 | 「值当指针」把数组看成链表找环 | 287 |
| 24 | 翻转与轮转 | 数组整体平移 k 位、原地反转 | 189 |
| 25 | 矩阵四板斧 | 旋转/置零/螺旋/有序矩阵查找 | 48,73,54,240 |
| 26 | 前后缀分解 | 「除自己外的聚合」不让用除法 | 238 |
| 27 | 找规律构造 | 下一个排列、杨辉三角这类「按规则造」 | 31,118 |

> **一句话记忆**:这些题大多在考「**别用额外空间 / 别用除法 / 别排序**,你还能不能做到」——答案都是某个巧妙的原地操作。

---

## 19. 位运算·异或(XOR 消消乐)

**识别信号**
- 「除了一个数,其它都出现两次(偶数次),找那个只出现一次的」。
- 要求 **O(1) 空间**(不能用哈希计数)。
- 关键词:配对消除、找不同、交换不用临时变量。

**为什么**
异或的三条铁律:`a^a=0`(相同抵消)、`a^0=a`(和 0 无变化)、满足交换律结合律(顺序随便)。于是把全部数异或起来,成对的自己抵消成 0,只剩那个单身狗。

**解题步骤**
1. 令 `res = 0`。
2. 遍历数组,`res ^= x`,把每个数异或进去。
3. 成对的相互抵消,最后 `res` 就是只出现一次的数。

**Python 模板**
```python
# 136 只出现一次的数字
def single_number(nums):
    res = 0
    for x in nums:
        res ^= x          # 成对抵消,单个留下
    return res

# 位运算常用招式(小抄)
def bit_tricks(x, i):
    get_bit   = (x >> i) & 1          # 取第 i 位
    set_bit   = x | (1 << i)          # 第 i 位置 1
    clear_bit = x & ~(1 << i)         # 第 i 位清 0
    lowbit    = x & (-x)              # 最低位的 1(树状数组常用)
    count_one = bin(x).count('1')     # 1 的个数
    is_pow2   = x > 0 and (x & (x - 1)) == 0   # 是否 2 的幂
    return get_bit, set_bit, clear_bit, lowbit, count_one, is_pow2
```

**ACM 模板**
```python
import sys
from functools import reduce
def main():
    nums = list(map(int, sys.stdin.read().split()))
    print(reduce(lambda a, b: a ^ b, nums, 0))
main()
```

**复杂度**:时间 O(n),空间 O(1)。

**Hot100 对应题(按难度)**
- 🟢 136. 只出现一次的数字

**常见坑**
- 异或只对「其余都出现**偶数**次」有效;出现 3 次的变体(如 137)要用「按位计数 % 3」,别硬套。
- `a^a=0` 别写成 `a&a`。

**口诀**:*成对异或全抵消,剩下就是那个单。*

---

## 20. 摩尔投票(Boyer–Moore Voting)

**识别信号**
- 「找出现次数 **超过一半**(严格 > n/2)的元素(多数元素)」。
- 要求 **O(1) 空间、O(n) 时间**(不许哈希、不许排序)。

**为什么**
多数元素比其它所有元素加起来还多。把「不同的两个元素」两两抵消,最后活下来的一定是多数元素——就像投票,多数派人多,再怎么对冲也剩得下。

**解题步骤**
1. 维护 `cand`(候选)和 `cnt`(票数,初始 0)。
2. 遍历:`cnt==0` 时把当前数设为新候选;相同则 `cnt+1`,不同则 `cnt-1`。
3. 遍历完 `cand` 即答案(题目保证存在多数元素时无需二次验证)。

**Python 模板**
```python
# 169 多数元素
def majority_element(nums):
    cand, cnt = 0, 0
    for x in nums:
        if cnt == 0:
            cand = x            # 换候选
        cnt += 1 if x == cand else -1
    return cand
```

**ACM 模板**
```python
import sys
def main():
    nums = list(map(int, sys.stdin.read().split()))
    cand = cnt = 0
    for x in nums:
        if cnt == 0: cand = x
        cnt += 1 if x == cand else -1
    print(cand)
main()
```

**复杂度**:时间 O(n),空间 O(1)。

**Hot100 对应题(按难度)**
- 🟢 169. 多数元素

**常见坑**
- 只在「保证存在过半元素」时才不用验证;不保证时要再扫一遍统计 `cand` 真实次数。
- 求「出现超过 n/3 的元素」是变体,要维护**两个**候选。

**口诀**:*同增异减票抵消,幸存候选是多数。*

---

## 21. 荷兰国旗(三向切分 / 三指针)

**识别信号**
- 数组「只有 3 种取值」(如 0/1/2、红白蓝),要**原地**排好序或按枢轴三分区。
- 要求一次遍历、O(1) 空间。

**为什么**
用三个指针把数组切成「< 区 | 待定区 | > 区」三段,遍历时把 0 甩到左、2 甩到右、1 留中间,一趟搞定,比计数排序还省一次写回。

**解题步骤**
1. `left=0`(下一个 0 该放的位置)、`i=0`(当前扫描)、`right=n-1`(下一个 2 该放的位置)。
2. `nums[i]==0`:和 `left` 交换,`left++,i++`;`==2`:和 `right` 交换,`right--`(**i 不动**,换来的还没检查);`==1`:`i++`。
3. `while i <= right` 结束。

**Python 模板**
```python
# 75 颜色分类
def sort_colors(nums):
    left, i, right = 0, 0, len(nums) - 1
    while i <= right:
        if nums[i] == 0:
            nums[left], nums[i] = nums[i], nums[left]
            left += 1; i += 1
        elif nums[i] == 2:
            nums[i], nums[right] = nums[right], nums[i]
            right -= 1                 # 注意:i 不前进!
        else:
            i += 1
```

**ACM 模板**
```python
import sys
def main():
    nums = list(map(int, sys.stdin.read().split()))
    left, i, right = 0, 0, len(nums) - 1
    while i <= right:
        if nums[i] == 0:
            nums[left], nums[i] = nums[i], nums[left]; left += 1; i += 1
        elif nums[i] == 2:
            nums[i], nums[right] = nums[right], nums[i]; right -= 1
        else:
            i += 1
    print(*nums)
main()
```

**复杂度**:时间 O(n),空间 O(1)。

**Hot100 对应题(按难度)**
- 🟡 75. 颜色分类

**常见坑**
- 换到右边(遇 2)后 **`i` 不能 ++**,因为换过来的元素还没检查。
- 循环条件是 `i <= right`,不是 `< n`(right 右边已排好)。

**口诀**:*零甩左二甩右,换右不动看回头。*

---

## 22. 原地哈希(下标当哈希桶)

**识别信号**
- 数组长度 n,值域恰好是 `[1, n]`(或 `[0, n-1]`)。
- 找「缺失的数 / 重复的数」且要求 **O(1) 额外空间**。
- 关键词:第一个缺失正数、找所有消失的数字、找重复。

**为什么**
值和下标一一对应时,数组自己就是一张哈希表:把值 `v` 归位到下标 `v-1`。归位完扫一遍,「下标 i 上不是 i+1」的就是缺口。

**解题步骤**
1. 遍历,对每个位置:只要 `nums[i]` 在 `[1,n]` 且没归位(`nums[nums[i]-1] != nums[i]`),就 `while` 把它换到正确位置。
2. 再遍历,第一个 `nums[i] != i+1` 的 `i+1` 即答案。
3. 全部归位则答案是 `n+1`。

**Python 模板**
```python
# 41 缺失的第一个正数
def first_missing_positive(nums):
    n = len(nums)
    for i in range(n):
        # 把 nums[i] 放到它该在的位置 nums[i]-1
        while 1 <= nums[i] <= n and nums[nums[i] - 1] != nums[i]:
            j = nums[i] - 1
            nums[i], nums[j] = nums[j], nums[i]
    for i in range(n):
        if nums[i] != i + 1:
            return i + 1
    return n + 1
```

**ACM 模板**
```python
import sys
def main():
    nums = list(map(int, sys.stdin.read().split()))
    n = len(nums)
    for i in range(n):
        while 1 <= nums[i] <= n and nums[nums[i] - 1] != nums[i]:
            j = nums[i] - 1
            nums[i], nums[j] = nums[j], nums[i]
    ans = n + 1
    for i in range(n):
        if nums[i] != i + 1:
            ans = i + 1; break
    print(ans)
main()
```

**复杂度**:时间 O(n)(每个数最多换一次到位),空间 O(1)。

**Hot100 对应题(按难度)**
- 🔴 41. 缺失的第一个正数(Hard,但套路固定)

**常见坑**
- 交换条件写成 `nums[nums[i]-1] != nums[i]`,不是 `!= i+1`,否则相同值会**死循环**。
- 换完 `i` 不要立刻 `+1`(换来的新值还要继续归位),所以用 `while` 不是 `if`。
- 别忘了「全部归位 → 答案 n+1」这个收尾。

**口诀**:*值当下标归原位,谁不在位谁就缺。*

---

## 23. 快慢指针·数组版(值当指针找环)

**识别信号**
- 数组长 n+1,值域 `[1, n]`,必有重复,要求**不改数组、O(1) 空间**找那个重复数。
- 关键词:寻找重复数、不能排序、不能开哈希。

**为什么**
把 `i → nums[i]` 看成「从下标 i 指向下标 nums[i]」的链表。因为有重复值,必有两个下标指向同一个点 → 链表成环,重复数就是**环的入口**。于是套用链表找环(Floyd)。

**解题步骤**
1. 快慢指针都从 0 出发:`slow=nums[slow]`(走一步),`fast=nums[nums[fast]]`(走两步),直到相遇。
2. 让一个指针回到 0,两指针同速前进,再次相遇点即环入口 = 重复数。

**Python 模板**
```python
# 287 寻找重复数(不改数组、O(1) 空间)
def find_duplicate(nums):
    slow = fast = 0
    while True:                        # 第一阶段:找相遇点
        slow = nums[slow]
        fast = nums[nums[fast]]
        if slow == fast:
            break
    p = 0                              # 第二阶段:找环入口
    while p != slow:
        p = nums[p]
        slow = nums[slow]
    return p
```

**ACM 模板**
```python
import sys
def main():
    nums = list(map(int, sys.stdin.read().split()))
    slow = fast = 0
    while True:
        slow = nums[slow]; fast = nums[nums[fast]]
        if slow == fast: break
    p = 0
    while p != slow:
        p = nums[p]; slow = nums[slow]
    print(p)
main()
```

**复杂度**:时间 O(n),空间 O(1)。

**Hot100 对应题(按难度)**
- 🟡 287. 寻找重复数(可原地哈希,但那会改数组;要求不改就用本法或二分值域)

**常见坑**
- `fast` 是 `nums[nums[fast]]`(跳两格),别只跳一格。
- 这题也能「二分值域 + 统计 ≤mid 的个数」,O(n log n),同样不改数组。
- 若允许改数组,直接用模板 22 原地哈希更直观。

**口诀**:*下标连成链,有重复就有环。*

---

## 24. 数组翻转与轮转(三次反转大法)

**识别信号**
- 「把数组整体向右/左平移 k 位」「原地轮转」,要求 O(1) 额外空间。

**为什么**
向右转 k 位 = 「整体翻转 → 前 k 个翻转 → 后 n-k 个翻转」。三次反转把「搬移」变成「翻转」,不用额外数组。

**解题步骤**
1. `k %= n`(转一圈等于没转)。
2. 翻转整个数组。
3. 翻转前 k 个,再翻转后 n-k 个。

**Python 模板**
```python
# 189 轮转数组(向右轮转 k 步)
def rotate(nums, k):
    n = len(nums)
    k %= n
    def reverse(a, b):
        while a < b:
            nums[a], nums[b] = nums[b], nums[a]
            a += 1; b -= 1
    reverse(0, n - 1)      # 整体翻
    reverse(0, k - 1)      # 前 k 个翻
    reverse(k, n - 1)      # 后 n-k 个翻
```

**ACM 模板**
```python
import sys
def main():
    data = list(map(int, sys.stdin.read().split()))
    k = data[-1]; nums = data[:-1]      # 约定最后一个数是 k
    n = len(nums); k %= n
    def reverse(a, b):
        while a < b:
            nums[a], nums[b] = nums[b], nums[a]; a += 1; b -= 1
    reverse(0, n-1); reverse(0, k-1); reverse(k, n-1)
    print(*nums)
main()
```

**复杂度**:时间 O(n),空间 O(1)。

**Hot100 对应题(按难度)**
- 🟡 189. 轮转数组

**常见坑**
- 一定先 `k %= n`,否则 k>n 越界。
- 向右转是「整体→前 k→后 n-k」;向左转顺序不同,别记反。

**口诀**:*整体翻,分段翻,平移变成三次翻。*

---

## 25. 原地矩阵操作四板斧(旋转 / 置零 / 螺旋 / Z 查找)

**识别信号**
- 二维矩阵的原地操作:顺时针旋转 90°、某行列置零、螺旋顺序输出、在「行列都有序」的矩阵里查找。

**为什么**
这四类**原地坐标操作题**靠「坐标变换规律 + 原地标记」。它们不覆盖所有矩阵题：区域统计转二维前缀，连通/路径转图搜索，Attention/矩阵乘转数值计算，复杂棋盘规则转状态模拟。

四个固定套路:
- **旋转 = 转置 + 每行翻转**;
- **置零 = 用首行首列当标记位**(省 O(m+n) 空间);
- **螺旋 = 四边界收缩模拟**;
- **有序矩阵查找 = 从右上角走 Z 字**(大就下移、小就左移)。

**Python 模板**
```python
# 48 旋转图像(顺时针 90°):转置 + 每行翻转
def rotate_matrix(m):
    n = len(m)
    for i in range(n):
        for j in range(i + 1, n):
            m[i][j], m[j][i] = m[j][i], m[i][j]     # 转置
    for row in m:
        row.reverse()                                # 每行翻转

# 73 矩阵置零:用首行首列当标记
def set_zeroes(m):
    rows, cols = len(m), len(m[0])
    first_row = any(m[0][j] == 0 for j in range(cols))
    first_col = any(m[i][0] == 0 for i in range(rows))
    for i in range(1, rows):
        for j in range(1, cols):
            if m[i][j] == 0:
                m[i][0] = m[0][j] = 0
    for i in range(1, rows):
        for j in range(1, cols):
            if m[i][0] == 0 or m[0][j] == 0:
                m[i][j] = 0
    if first_row:
        for j in range(cols): m[0][j] = 0
    if first_col:
        for i in range(rows): m[i][0] = 0

# 54 螺旋矩阵:四边界收缩
def spiral_order(m):
    if not m: return []
    res = []
    top, bot, left, right = 0, len(m) - 1, 0, len(m[0]) - 1
    while top <= bot and left <= right:
        for j in range(left, right + 1): res.append(m[top][j])
        top += 1
        for i in range(top, bot + 1): res.append(m[i][right])
        right -= 1
        if top <= bot:
            for j in range(right, left - 1, -1): res.append(m[bot][j])
            bot -= 1
        if left <= right:
            for i in range(bot, top - 1, -1): res.append(m[i][left])
            left += 1
    return res

# 240 搜索二维矩阵 II:从右上角 Z 字查找
def search_matrix(m, target):
    if not m: return False
    i, j = 0, len(m[0]) - 1          # 右上角
    while i < len(m) and j >= 0:
        if m[i][j] == target: return True
        elif m[i][j] > target: j -= 1    # 太大,左移
        else: i += 1                     # 太小,下移
    return False
```

**ACM 模板**(螺旋矩阵为例)
```python
import sys
def main():
    data = sys.stdin.read().split()
    r, c = int(data[0]), int(data[1])
    vals = list(map(int, data[2:2 + r * c]))
    m = [vals[i*c:(i+1)*c] for i in range(r)]
    res = []
    top, bot, left, right = 0, r - 1, 0, c - 1
    while top <= bot and left <= right:
        for j in range(left, right+1): res.append(m[top][j])
        top += 1
        for i in range(top, bot+1): res.append(m[i][right])
        right -= 1
        if top <= bot:
            for j in range(right, left-1, -1): res.append(m[bot][j])
            bot -= 1
        if left <= right:
            for i in range(bot, top-1, -1): res.append(m[i][left])
            left += 1
    print(*res)
main()
```

**复杂度**:旋转/置零/螺旋 O(m·n);Z 字查找 O(m+n)。空间均 O(1)。

**Hot100 对应题(按难度)**
- 🟡 48. 旋转图像 / 🟡 73. 矩阵置零 / 🟡 54. 螺旋矩阵 / 🟡 240. 搜索二维矩阵 II
- (🟡 74. 搜索二维矩阵 I 属于二分,见主篇模板 7)

**常见坑**
- 旋转顺时针 = 转置后**每行翻转**;逆时针 = 转置后每列翻转(或先翻行再转置)。
- 螺旋收缩后画第三、四条边前要判 `top<=bot` / `left<=right`,否则单行单列会重复。
- 240 必须从**右上角或左下角**出发(那里才有单调性),从左上角不行。

**口诀**:*转置翻行是旋转,首行首列作标记;螺旋四界往里收,有序查找走右上。*

---

## 26. 前后缀分解(不用除法的乘积/聚合)

**识别信号**
- 「求每个位置**除自己以外**其余元素的聚合(乘积/和)」,且**不许用除法**、要 O(n)。

**为什么**
`答案[i] = (i 左边所有的积) × (i 右边所有的积)`。先用一趟前缀积填左边贡献,再用一趟后缀积乘上右边贡献,两趟 O(n) 且不碰除法(能绕开有 0 的坑)。

**解题步骤**
1. `res[i]` 先存「i 左边所有元素的积」(前缀积,`res[0]=1`)。
2. 再从右往左维护后缀积 `suf`,`res[i] *= suf`,然后 `suf *= nums[i]`。

**Python 模板**
```python
# 238 除自身以外数组的乘积
def product_except_self(nums):
    n = len(nums)
    res = [1] * n
    pre = 1
    for i in range(n):                 # res[i] = 左边所有的积
        res[i] = pre
        pre *= nums[i]
    suf = 1
    for i in range(n - 1, -1, -1):     # 再乘上右边所有的积
        res[i] *= suf
        suf *= nums[i]
    return res
```

**ACM 模板**
```python
import sys
def main():
    nums = list(map(int, sys.stdin.read().split()))
    n = len(nums); res = [1]*n
    pre = 1
    for i in range(n): res[i] = pre; pre *= nums[i]
    suf = 1
    for i in range(n-1, -1, -1): res[i] *= suf; suf *= nums[i]
    print(*res)
main()
```

**复杂度**:时间 O(n),空间 O(1)(输出数组不计)。

**Hot100 对应题(按难度)**
- 🟡 238. 除自身以外数组的乘积

**常见坑**
- 用除法(总积/自己)遇到 0 会崩;题目正是要你**别用除法**。
- 后缀那趟要「先乘再更新 suf」,顺序反了会把自己也乘进去。

**口诀**:*左积一趟右积一趟,除己乘积不用除。*

---

## 27. 找规律构造(下一个排列 / 杨辉三角)

**识别信号**
- 「求字典序的**下一个排列**」「按行生成杨辉三角」这类「按固定规则一步步造出结果」的题。
- 没有明显算法名,靠**观察规律 + 手推小样例**。

**为什么**
- 下一个排列:要变大但尽量小 → 从右找第一个「升高点」`nums[i]<nums[i+1]`,把它换成右边刚好比它大的数,再把右边翻转成最小的升序。
- 杨辉三角:`row[j] = 上一行[j-1] + 上一行[j]`,纯递推。

**解题步骤(下一个排列)**
1. 从右往左找第一个 `i` 使 `nums[i] < nums[i+1]`(升高点)。
2. 若存在:再从右找第一个 `nums[j] > nums[i]`,交换 `i, j`。
3. 把 `i+1` 到末尾**翻转**(变最小升序)。若不存在升高点(整体降序),直接整体翻转成升序。

**Python 模板**
```python
# 31 下一个排列
def next_permutation(nums):
    n = len(nums)
    i = n - 2
    while i >= 0 and nums[i] >= nums[i + 1]:
        i -= 1                          # 找升高点
    if i >= 0:
        j = n - 1
        while nums[j] <= nums[i]:
            j -= 1                      # 找刚好比 nums[i] 大的
        nums[i], nums[j] = nums[j], nums[i]
    # 翻转 i 右边,使其升序(最小)
    left, right = i + 1, n - 1
    while left < right:
        nums[left], nums[right] = nums[right], nums[left]
        left += 1; right -= 1

# 118 杨辉三角
def generate(numRows):
    res = []
    for i in range(numRows):
        row = [1] * (i + 1)
        for j in range(1, i):
            row[j] = res[i - 1][j - 1] + res[i - 1][j]
        res.append(row)
    return res
```

**ACM 模板**
```python
import sys
def main():
    nums = list(map(int, sys.stdin.read().split()))
    n = len(nums); i = n - 2
    while i >= 0 and nums[i] >= nums[i+1]: i -= 1
    if i >= 0:
        j = n - 1
        while nums[j] <= nums[i]: j -= 1
        nums[i], nums[j] = nums[j], nums[i]
    l, r = i + 1, n - 1
    while l < r:
        nums[l], nums[r] = nums[r], nums[l]; l += 1; r -= 1
    print(*nums)
main()
```

**复杂度**:下一个排列 O(n);杨辉三角 O(numRows²)。空间 O(1) / O(结果大小)。

**Hot100 对应题(按难度)**
- 🟢 118. 杨辉三角
- 🟡 31. 下一个排列

**常见坑**
- 找升高点和找交换点都用 `>=` / `<=`(含等号),否则有重复元素时会错。
- 最后一步是**翻转**(因为右段本就是降序,翻转即得升序),不用重新排序。
- 整体降序(如 `[3,2,1]`)时 `i=-1`,直接翻转整个数组。

**口诀**:*右找升高换个大,右段翻转即下一。*

---

# 📎 附录 A:位运算招式小抄

| 目的 | 写法 |
|------|------|
| 取第 i 位 | `(x >> i) & 1` |
| 第 i 位置 1 | `x \| (1 << i)` |
| 第 i 位清 0 | `x & ~(1 << i)` |
| 第 i 位翻转 | `x ^ (1 << i)` |
| 取最低位的 1 | `x & (-x)` |
| 去掉最低位的 1 | `x & (x - 1)` |
| 判断 2 的幂 | `x > 0 and (x & (x-1)) == 0` |
| 统计 1 的个数 | `bin(x).count('1')` |
| 判奇偶 | `x & 1` |
| 不用临时变量交换 | `a ^= b; b ^= a; a ^= b` |

# 📎 附录 B:这些「技巧题」怎么在决策术里识别

在主篇《决策术》第 3 步「还没命中」时,补充问自己:

```
要 O(1) 空间 + 「都成对只有一个单」?      → 19 异或
要 O(1) 空间 + 「找过半元素」?            → 20 摩尔投票
只有 3 种值要原地排序?                    → 21 荷兰国旗
值域是 [1,n] 找缺失/重复 + O(1) 空间?     → 22 原地哈希 / 23 快慢指针(不改数组)
数组整体平移 k 位?                        → 24 三次反转
矩阵旋转/置零/螺旋/有序查找?              → 25 矩阵四板斧
求「除自己外的乘积」且不许除法?           → 26 前后缀分解
「下一个排列 / 按规则生成」?              → 27 找规律构造
```

> 记忆锚点:**这些题的题干里几乎都藏着一句「要求 O(1) 空间」或「不许用 XX」**——这句限制就是在提示你放弃暴力/哈希,改用本篇的某个巧劲。

# 🎯 技巧篇 9 口诀速记

19. 异或:成对异或全抵消,剩下就是那个单。
20. 摩尔投票:同增异减票抵消,幸存候选是多数。
21. 荷兰国旗:零甩左二甩右,换右不动看回头。
22. 原地哈希:值当下标归原位,谁不在位谁就缺。
23. 快慢指针:下标连成链,有重复就有环。
24. 翻转轮转:整体翻分段翻,平移变成三次翻。
25. 矩阵四板斧:转置翻行是旋转,螺旋收界走右上。
26. 前后缀:左积一趟右积一趟,除己乘积不用除。
27. 找规律:右找升高换个大,右段翻转即下一。
