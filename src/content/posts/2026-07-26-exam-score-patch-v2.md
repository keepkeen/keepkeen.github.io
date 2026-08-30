---
title: "大厂笔试提分补丁 v2：模板 36–44"
description: "补齐记忆化、二维前缀和、背包、进制、区间/树形 DP、逆序对、自定义排序与恰好 K。"
date: 2026-07-26
updatedDate: 2026-08-31
tags:
  - algorithms
  - leetcode
  - interview
featured: false
draft: false
lang: zh-CN
series: algorithm-exam-training
seriesOrder: 8
---
> 本文完整同步自个人求职工作区，更新于 2026-08-31。源文件及后续更新托管在 GitHub 仓库 [llm-algo-job-notes](https://github.com/keepkeen/llm-algo-job-notes)。

> 这是《大厂笔试超纲补丁》的续篇,专门补齐一次「100 题体检 + 多视角审阅」中发现的**高性价比缺口**。
> 面向:能做简单题、一周冲大厂笔试。这些是**用你已会的(暴力/递归)换你不会的(DP/构造)**、以及送分基本功的关键工具。
> 格式沿用 9 件套。本文关键模板已做编译与代表性边界检查；带 `...` 的思路骨架需按题意补全后再运行。

## 本篇总览

| # | 考点 | 一句话触发条件 | 优先级 |
|---|------|----------------|--------|
| 36 | 记忆化搜索 | 「暴力递归有重叠子问题」→ 一行装饰器变 DP | ⭐⭐⭐ 头号 |
| 37 | 二维前缀和 | 「反复查子矩阵区域和」 | ⭐⭐⭐ 必背 |
| 38 | 0/1 背包·价值最大化 | 「容量限制下选物品使价值最大」 | ⭐⭐⭐ 必背 |
| 39 | 进制 + 字符串工具箱 | 「k 进制互转 / 字符串解析」送分题 | ⭐⭐⭐ 必背 |
| 40 | 区间 DP | 「区间合并 / 两端向中间 / 戳气球石子」 | ⭐⭐ 高频 |
| 41 | 树形 DP | 「树上求最优,每节点返状态给父亲」 | ⭐⭐ 高频 |
| 42 | 逆序对(归并) | 「统计逆序对 / 归并分治计数」 | ⭐⭐ 高频 |
| 43 | 自定义排序 | 「拼接最大数 / 多关键字 / 自定义比较」 | ⭐⭐ 高频 |
| 44 | 滑窗「恰好 K」 | 「子数组恰好满足 K 个某条件的个数」 | ⭐ 变体 |

> **心法**:36 是全篇最高杠杆——**只要会写暴力递归,加 `@lru_cache(None)` 就变 DP**,不用想递推顺序和初始化,专骗第 3~4 题部分分。

---

## 36. 记忆化搜索(@lru_cache / 手写 memo)

**识别信号**
- 你能写出**暴力递归**(把大问题拆成子问题),但发现**子问题被重复计算**。
- DP 的递推顺序/初始化想不清楚时——记忆化是「自顶向下的 DP」,不用管顺序。
- 关键词:能拆成子问题、返回值只依赖参数、参数范围有限。

**为什么**
暴力递归慢是因为同一个 `(参数)` 被算很多遍。记忆化用一张表缓存「参数 → 结果」,每个状态只算一次,复杂度立刻从指数降到「状态数 × 单次转移」。**它和递推 DP 等价,但你只需写出递归式,不用推顺序**——这对初学者是最省脑力的 DP 入口。

**解题步骤**
1. 写出暴力递归:`dfs(状态) = 由更小状态组合出的答案`,想清 base case。
2. 在函数上加 `@lru_cache(None)`(或手写字典 memo)。
3. **要求:参数必须可哈希**(用 int/tuple,别传 list);别在递归里改全局可变状态。

**Python 模板**
```python
from functools import lru_cache

# 通法:把任何"无副作用、参数可哈希"的暴力递归变 DP
def unique_paths(m, n):                 # 62 不同路径
    @lru_cache(None)
    def dfs(i, j):
        if i == 0 or j == 0:            # 边界:第一行/列只有一条路
            return 1
        return dfs(i - 1, j) + dfs(i, j - 1)
    return dfs(m - 1, n - 1)

# 零钱兑换(322)记忆化写法——对比背包更直观
def coin_change(coins, amount):
    @lru_cache(None)
    def dfs(rest):
        if rest == 0: return 0
        if rest < 0: return float('inf')
        return min((dfs(rest - c) + 1 for c in coins), default=float('inf'))
    ans = dfs(amount)
    return ans if ans != float('inf') else -1

# 手写 memo(不想用装饰器 / 参数复杂时)
def solve(n):
    memo = {}
    def dfs(state):
        if state in memo: return memo[state]
        # ... base case ...
        res = ...                        # 由子状态组合
        memo[state] = res
        return res
    return dfs(n)
```

**ACM 模板**
```python
import sys
def main():
    data = sys.stdin.read().split()
    m, n = int(data[0]), int(data[1])
    if m <= 0 or n <= 0:
        raise ValueError("m and n must be positive")
    dp = [1] * n                         # 深状态链优先改递推,不靠超大递归上限
    for _ in range(1, m):
        for j in range(1, n):
            dp[j] += dp[j - 1]
    print(dp[-1])
main()
```

**复杂度**:O(状态数 × 单次转移)。空间 O(状态数)(缓存表)。

**典型题**:不同路径、零钱兑换、单词拆分、最长递增子序列、正则匹配、戳气球、几乎所有能写成递归的 DP。

**常见坑**
- **参数必须可哈希**:传 `list` 会报错,改传下标 `i` 或 `tuple`。
- 状态依赖形成长链时优先改递推/显式栈；`setrecursionlimit` 不会增加 C 栈,不能保证深递归安全(见 IO 文档「递归深度真坑」)。
- 别在被缓存的函数里读写会变的全局变量,否则缓存结果是错的。

**口诀**:*暴力递归加缓存,子问题只算一遍。*

---

## 37. 二维前缀和(子矩阵区域和)

**识别信号**
- 「反复查询某个**子矩阵的元素和**」「最大子矩阵和」「统计和为 target 的子矩阵」。
- 一维前缀和的二维版。

**为什么**
预处理 `pre[i][j]` = 左上角到 `(i-1,j-1)` 的矩形和,任意子矩阵和用**容斥**一次算出,把「每次查询 O(mn)」降到 O(1)。

**解题步骤**
1. 建 `pre`(多开一行一列,`pre[i+1][j+1]` 对应原 `(i,j)`)。
2. 递推:`pre[i+1][j+1] = pre[i][j+1] + pre[i+1][j] - pre[i][j] + mat[i][j]`。
3. 查子矩阵 `[r1,c1]~[r2,c2]`(闭区间):`pre[r2+1][c2+1] - pre[r1][c2+1] - pre[r2+1][c1] + pre[r1][c1]`。

**Python 模板**
```python
def build_prefix_2d(mat):
    m, n = len(mat), len(mat[0])
    pre = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m):
        for j in range(n):
            pre[i+1][j+1] = pre[i][j+1] + pre[i+1][j] - pre[i][j] + mat[i][j]
    return pre

def query(pre, r1, c1, r2, c2):          # 闭区间 [r1,c1]~[r2,c2] 的和
    return pre[r2+1][c2+1] - pre[r1][c2+1] - pre[r2+1][c1] + pre[r1][c1]
```

**ACM 模板**
```python
import sys
def main():
    data = sys.stdin.read().split()
    idx = 0
    m, n = int(data[idx]), int(data[idx+1]); idx += 2
    mat = [[int(data[idx + i*n + j]) for j in range(n)] for i in range(m)]; idx += m*n
    pre = [[0]*(n+1) for _ in range(m+1)]
    for i in range(m):
        for j in range(n):
            pre[i+1][j+1] = pre[i][j+1] + pre[i+1][j] - pre[i][j] + mat[i][j]
    q = int(data[idx]); idx += 1         # q 次查询
    out = []
    for _ in range(q):
        r1,c1,r2,c2 = (int(data[idx+k]) for k in range(4)); idx += 4
        out.append(str(pre[r2+1][c2+1]-pre[r1][c2+1]-pre[r2+1][c1]+pre[r1][c1]))
    print('\n'.join(out))
main()
```

**复杂度**:预处理 O(mn),每次查询 O(1)。

**典型题**:二维区域和检索、和 ≥ target 的最短子矩阵、最大子矩阵和(配合一维压缩)。

**常见坑**
- 下标偏移:`pre` 多开一圈,`pre[i+1][j+1]` 才对应 `mat[i][j]`。
- 容斥公式「减两块、加回重叠一块」,符号别错。
- 和一维/二维**差分**区分:前缀和是「查」,差分是「改」。

**口诀**:*左上矩形先预处理,子矩阵和容斥求。*

---

## 38. 0/1 背包·价值最大化(标准背包)

**识别信号**
- 「每个物品有**重量 w 和价值 v**,背包容量 C,选一些物品使**总价值最大**」。
- 这是背包最经典的形态(超纲篇模板 16 只讲了可行性/最少个数,这里补价值版)。

**为什么**
`dp[c]` = 容量为 c 时能获得的最大价值。每个物品「选(腾出 w 容量换 v 价值)或不选」,取更大者。一维滚动 + **容量倒序**保证每物品只用一次。

**解题步骤**
1. `dp[c]` 初始化全 0(容量 c 下最大价值)。
2. 外层遍历物品 `(w, v)`,内层容量 `c` 从大到小到 `w`。
3. `dp[c] = max(dp[c], dp[c-w] + v)`。

**Python 模板**
```python
# 0/1 背包:容量 cap,最大化价值
def knapsack_01(weights, values, cap):
    if len(weights) != len(values):
        raise ValueError("weights and values must have the same length")
    if cap < 0 or any(w <= 0 for w in weights):
        raise ValueError("cap must be non-negative and weights must be positive")
    dp = [0] * (cap + 1)
    for w, v in zip(weights, values):
        for c in range(cap, w - 1, -1):       # 倒序:每个物品用一次
            dp[c] = max(dp[c], dp[c - w] + v)
    return dp[cap]

# 完全背包(物品无限次)只改内层为正序
def knapsack_complete(weights, values, cap):
    if len(weights) != len(values):
        raise ValueError("weights and values must have the same length")
    if cap < 0 or any(w <= 0 for w in weights):
        raise ValueError("cap must be non-negative and weights must be positive")
    dp = [0] * (cap + 1)
    for w, v in zip(weights, values):
        for c in range(w, cap + 1):           # 正序:可重复用
            dp[c] = max(dp[c], dp[c - w] + v)
    return dp[cap]
```

**ACM 模板**
```python
import sys
def main():
    data = sys.stdin.read().split()
    idx = 0
    n, cap = int(data[idx]), int(data[idx+1]); idx += 2
    if cap < 0:
        raise ValueError("cap must be non-negative")
    dp = [0]*(cap+1)
    for _ in range(n):
        w, v = int(data[idx]), int(data[idx+1]); idx += 2
        if w <= 0:
            raise ValueError("weights must be positive")
        for c in range(cap, w-1, -1):
            dp[c] = max(dp[c], dp[c-w] + v)
    print(dp[cap])
main()
```

**复杂度**:时间 O(物品数 × 容量),空间 O(容量)。

**典型题**:标准 0/1 背包、完全背包、分组背包、二维费用背包(加一维容量)。

**常见坑**
- 模板契约:`len(weights) == len(values)`,`cap >= 0`,且每个重量 `w > 0`;否则 `zip` 会静默丢物品,零/负重量也会破坏转移含义。
- **0/1 倒序、完全正序**(和超纲篇模板 16 一致,最易错)。
- 「恰好装满」要 `dp[0]=0, 其余=-inf`;「不超过容量」全 0 即可。
- 内层下界 `range(cap, w-1, -1)`,别把 `w` 写掉导致越界。

**口诀**:*容量倒序防重选,选或不选取大者。*

---

## 39. 进制转换 + 字符串处理工具箱

**识别信号**
- 「k 进制互转」「二进制/十六进制」「大小写、字符统计、分割解析」这类**送分基本功**。
- 华为/字节笔试第 1~2 题极爱考,不会就白丢。

**为什么**
这些不是算法,是**Python 内置能力的熟练度**。背下这张小抄,送分题秒切,把时间省给难题。

**解题步骤**:直接查下面工具箱。

**Python 模板**
```python
# ===== 进制转换 =====
# 其它进制字符串 -> 十进制
x = int("ff", 16)          # 255      int(s, base)  base 2~36
x = int("1010", 2)         # 10
# 十进制 -> 2/8/16 进制字符串(带前缀)
bin(10)    # '0b1010'      oct(10)  # '0o12'      hex(255) # '0xff'
bin(10)[2:]                # '1010'  去前缀
# 十进制 -> 任意 k 进制(手写)
def to_base(n, b):
    if not 2 <= b <= 36:
        raise ValueError("base must be in [2, 36]")
    if n == 0: return "0"
    d = "0123456789abcdefghijklmnopqrstuvwxyz"
    neg, n, out = n < 0, abs(n), []
    while n:
        out.append(d[n % b]); n //= b
    return ('-' if neg else '') + ''.join(reversed(out))

# ===== 字符串处理 =====
s = "  a1 B2  c3 "
s.strip()                  # 去首尾空白    s.split()  # 按空白切成 ['a1','B2','c3']
"a,b,c".split(",")         # ['a','b','c']  "".join(list) 拼接
c.isdigit(); c.isalpha(); c.isalnum(); c.isupper()   # 字符判定
c.lower(); c.upper()       # 大小写转换
ord('a')                   # 97   字符->码    chr(97) # 'a' 码->字符
ord(c) - ord('a')          # 字母 -> 0..25 下标(计数常用)
from collections import Counter
Counter("aabbc")           # {'a':2,'b':2,'c':1} 词频

# ===== 常见转换 =====
list("abc")                # ['a','b','c']
"".join(sorted("cba"))     # 'abc'  字符串排序
str.maketrans / s.translate# 批量字符替换(进阶)
```

**ACM 模板**(k 进制互转示例)
```python
import sys
def main():
    data = sys.stdin.read().split()
    s, from_b, to_b = data[0], int(data[1]), int(data[2])
    if not 2 <= from_b <= 36 or not 2 <= to_b <= 36:
        raise ValueError("bases must be in [2, 36]")
    n = int(s, from_b)                   # 先转十进制
    if n == 0:
        print("0"); return
    d = "0123456789abcdefghijklmnopqrstuvwxyz"
    neg, n, out = n < 0, abs(n), []
    while n:
        out.append(d[n % to_b]); n //= to_b
    print(('-' if neg else '') + ''.join(reversed(out)))
main()
```

**复杂度**:进制转换 O(位数);字符串操作视长度 O(n)。

**典型题**:进制转换、罗马数字、字符串转整数(atoi)、有效数字判定、单词计数、字符统计。

**常见坑**
- 任意进制模板只接收 `2 <= base <= 36`;负数先保存符号,对绝对值做除基取余,最后补回 `-`。
- `int(s, base)` 的 s 不含前缀(`int("ff",16)` 对,`int("0xff",16)` 也对但别依赖)。
- 字母转下标 `ord(c)-ord('a')`,大写用 `'A'`。
- 读「整行含空格」的字符串别用 `split()`(见 IO 文档)。

**口诀**:*进制先转十进制,字符串靠内置招式。*

---

## 40. 区间 DP(两端向中间合并)

**识别信号**
- 「在一个区间上操作,大区间的解由**小区间**合并而来」。
- 「戳气球、石子合并、最长回文子序列、括号匹配、矩阵连乘」。
- 特征:枚举区间的**分割点/最后操作点** `k`。

**为什么**
状态 `dp[i][j]` = 区间 `[i,j]` 的最优解,由「枚举中间点 k,把区间拆成 `[i,k]` 和 `[k,j]`」转移而来。**必须按区间长度从小到大**填表(小区间先算好)。

**解题步骤**
1. 定 `dp[i][j]`(区间 `[i,j]` 的最优/计数)。
2. **外层枚举区间长度**(或让 `i` 倒序、`j` 正序,保证子区间已算)。
3. 内层枚举分割点 `k`,合并子区间的解。

**Python 模板**
```python
# 最长回文子序列(516):区间 DP 入门(i 倒序保证 i+1 已算)
def longest_palindrome_subseq(s):
    n = len(s)
    if n == 0:
        return 0
    dp = [[0] * n for _ in range(n)]
    for i in range(n - 1, -1, -1):
        dp[i][i] = 1                          # 单字符回文长 1
        for j in range(i + 1, n):
            if s[i] == s[j]:
                dp[i][j] = dp[i + 1][j - 1] + 2
            else:
                dp[i][j] = max(dp[i + 1][j], dp[i][j - 1])
    return dp[0][n - 1]

# 戳气球(312):经典区间 DP(枚举最后戳破的 k)
def max_coins(nums):
    if any(x < 0 for x in nums):
        raise ValueError("nums must be non-negative")
    a = [1] + nums + [1]
    n = len(a)
    dp = [[0] * n for _ in range(n)]
    for length in range(2, n):                # 区间长度从小到大
        for i in range(n - length):
            j = i + length
            for k in range(i + 1, j):         # k 是最后戳破的
                dp[i][j] = max(dp[i][j],
                               dp[i][k] + dp[k][j] + a[i] * a[k] * a[j])
    return dp[0][n - 1]
```

**ACM 模板**(最长回文子序列)
```python
import sys
def main():
    s = sys.stdin.readline().strip()          # 读一个字符串
    m = len(s)
    if m == 0:
        print(0); return
    dp = [[0]*m for _ in range(m)]
    for i in range(m-1, -1, -1):
        dp[i][i] = 1
        for j in range(i+1, m):
            dp[i][j] = dp[i+1][j-1]+2 if s[i]==s[j] else max(dp[i+1][j], dp[i][j-1])
    print(dp[0][m-1])
main()
```

**复杂度**:最长回文子序列是 O(n²) 时间、O(n²) 空间；戳气球是 O(n³) 时间、O(n²) 空间。

**典型题**:最长回文子序列、戳气球、石子合并、多边形三角剖分、矩阵连乘、括号匹配。

**常见坑**
- 空串的最长回文子序列是 0；先返回,避免访问 `dp[0][-1]`。
- 填表顺序必须保证「子区间先于大区间」:要么外层枚举长度,要么 `i` 倒序 `j` 正序。
- LC 312 的 `max_coins` 契约是 `nums` **非负**；负数会使“每个气球最终都戳破”的零初始化逻辑失效。加哨兵 `[1]+nums+[1]`,`k` 是「最后」戳破的才无后效性。
- n³ 只适合 n≤500,再大要换思路。

**口诀**:*小区间先算大后合,枚举分割点 k。*

---

## 41. 树形 DP(树上的动态规划)

**识别信号**
- 「在**树/无根树**上求最优」,每个节点的答案依赖**子节点**的状态。
- 「树上打家劫舍、树的直径、监控二叉树、选课(树上背包)」。

**为什么**
树形 DP 的状态天然按**后序**合并:`state[node]` 表示以 node 为根的子树在若干状态下的最优值(常是「选 / 不选」元组)。用显式栈或父节点顺序拿到后序,就能兼顾清晰状态与深树安全。

**解题步骤**
1. 定义每个节点的**一组状态**(如 `(不选node最优, 选node最优)`)。
2. 用 `(node, visited)` 显式栈或 `parent + order` 得到后序,保证孩子先算。
3. 按「选了 node 则子节点不能选」等约束合并,返回本节点的状态元组。

**Python 模板**
```python
# 打家劫舍 III(337):树上不能偷相邻节点
def rob_tree(root):
    if not root:
        return 0
    stack = [(root, False)]
    state = {}                                  # id(node) -> (不偷, 偷)
    while stack:
        node, visited = stack.pop()
        if not visited:
            stack.append((node, True))
            if node.right: stack.append((node.right, False))
            if node.left: stack.append((node.left, False))
            continue
        left = state.get(id(node.left), (0, 0))
        right = state.get(id(node.right), (0, 0))
        state[id(node)] = (max(left) + max(right),
                           node.val + left[0] + right[0])
    return max(state[id(root)])

# 树的直径(通用邻接表版):返回最长路径的边数
def tree_diameter(n, graph):                  # graph 邻接表
    if n == 0:
        return 0
    parent = [-2] * n
    parent[0] = -1
    order = [0]
    for u in order:
        for v in graph[u]:
            if parent[v] == -2:
                parent[v] = u
                order.append(v)
    best, down = 0, [0] * n
    for u in reversed(order):                  # 孩子先于父亲
        top1 = top2 = 0                        # 最长、次长的向下链
        for v in graph[u]:
            if parent[v] != u: continue
            d = down[v] + 1
            if d > top1: top1, top2 = d, top1
            elif d > top2: top2 = d
        down[u] = top1
        best = max(best, top1 + top2)
    return best                                 # 非空树的路径点数 = best + 1
```

**ACM 模板**
```python
import sys
def main():
    data = sys.stdin.read().split()
    idx = 0
    n = int(data[idx]); idx += 1
    graph = [[] for _ in range(n)]
    for _ in range(n - 1):                     # 树有 n-1 条边
        a, b = int(data[idx]), int(data[idx+1]); idx += 2
        graph[a].append(b); graph[b].append(a)
    parent = [-2] * n
    parent[0] = -1
    order = [0]
    for u in order:                            # 显式栈展开父子关系
        for v in graph[u]:
            if parent[v] == -2:
                parent[v] = u
                order.append(v)
    best, down = 0, [0] * n
    for u in reversed(order):                  # 逆序就是后序
        t1 = t2 = 0
        for v in graph[u]:
            if parent[v] != u: continue
            d = down[v] + 1
            if d > t1: t1, t2 = d, t1
            elif d > t2: t2 = d
        down[u] = t1
        best = max(best, t1 + t2)
    print(best)
main()
```

**复杂度**:O(n)(每个节点访问一次),空间 O(n)(显式顺序与 DP 数组)。

**典型题**:打家劫舍 III、二叉树的直径/最大路径和(主篇模板 9)、监控二叉树、没有上司的舞会、树上背包(选课)。

**常见坑**
- 无根树要记录 `parent` 防止走回头路；`tree_diameter` 返回**边数**,非空树若要路径点数再加 1。
- 返回元组时别把「选/不选」两个状态用混。
- 递归深度 = 树高,退化成链时必须优先改显式栈/后序数组,不要把超大 `recursionlimit` 当安全保证。

**口诀**:*子树返状态给父亲,选与不选合并算。*

---

## 42. 逆序对(归并排序分治)

**识别信号**
- 「统计**逆序对**个数(i<j 但 a[i]>a[j])」「求一个序列的混乱度」「翻转对」。
- 朴素 O(n²) 超时,要 O(n log n)。

**为什么**
在归并排序**合并两个有序半区**时,若右半的元素 `R[j]` 比左半 `L[i]` 小,则 `L[i..]` 剩下的全部都和 `R[j]` 构成逆序对,一次性累加 `len(L)-i`。分治顺便把逆序对数得了。

**解题步骤**
1. 归并排序:分成左右两半递归。
2. 合并时,`L[i] > R[j]` 就 `cnt += len(L) - i`,取 R[j]。
3. 左右子问题的 cnt 累加。

**Python 模板**
```python
def count_inversions(nums):
    def merge_sort(a):
        if len(a) <= 1:
            return a, 0
        mid = len(a) // 2
        left, cl = merge_sort(a[:mid])
        right, cr = merge_sort(a[mid:])
        merged, cnt, i, j = [], cl + cr, 0, 0
        while i < len(left) and j < len(right):
            if left[i] <= right[j]:
                merged.append(left[i]); i += 1
            else:
                merged.append(right[j]); j += 1
                cnt += len(left) - i            # 关键:左边剩下的都比它大
        merged += left[i:]; merged += right[j:]
        return merged, cnt
    return merge_sort(nums)[1]
```

**ACM 模板**
```python
import sys
def main():
    data = sys.stdin.read().split()
    n = int(data[0]); nums = list(map(int, data[1:1+n]))
    def ms(a):
        if len(a) <= 1: return a, 0
        m = len(a)//2; L, cl = ms(a[:m]); R, cr = ms(a[m:])
        out, cnt, i, j = [], cl+cr, 0, 0
        while i < len(L) and j < len(R):
            if L[i] <= R[j]: out.append(L[i]); i += 1
            else: out.append(R[j]); j += 1; cnt += len(L)-i
        return out+L[i:]+R[j:], cnt
    print(ms(nums)[1])
main()
```

**复杂度**:时间 O(n log n),空间 O(n)。

**典型题**:数组中的逆序对、翻转对、计算右侧小于当前元素的个数、区间和的个数(进阶)。

**常见坑**
- 累加时机是「取右边元素」那一刻,加的是 `len(left)-i`(左边剩余量)。
- 相等时取左边(`<=`)保证不算成逆序对(稳定)。
- 也可用树状数组做,但归并更好背。

**口诀**:*归并合并时计数,右小则左剩全逆。*

---

## 43. 自定义排序(cmp_to_key / 多关键字)

**识别信号**
- 「拼接成**最大/最小数**」「按多个关键字排序」「排序规则不是简单大小」。
- 关键词:最大数、根据身高重建队列、区间排序、按字典序拼接。

**为什么**
简单排序用 `key=`;但当「谁在前」要**看两个元素的组合**(如 `a+b` vs `b+a`)时,得用 `cmp_to_key` 把「两两比较函数」变成 key。多关键字排序用 `key=lambda x:(主, 次)` 或负号控制升降。

**解题步骤**
1. 想清「a 排在 b 前」的判据。
2. 组合判据 → `cmp_to_key(cmp)`,`cmp(a,b)` 返回负=a在前、正=b在前。
3. 多关键字直接 `key=lambda x:(k1, -k2, ...)`。

**Python 模板**
```python
from functools import cmp_to_key

# 拼接最大数(179):a+b 和 b+a 谁大谁在前
def largest_number(nums):
    if not nums:
        return ''
    strs = sorted(map(str, nums),
                  key=cmp_to_key(lambda a, b: (a + b < b + a) - (a + b > b + a)))
    res = ''.join(strs)
    return '0' if res[0] == '0' else res     # 全 0 特判

# 多关键字排序:先按分数降序,分数同按名字升序
def sort_people(people):                      # people: [(name, score), ...]
    return sorted(people, key=lambda p: (-p[1], p[0]))

# 根据身高重建队列(406):高的先站,按 k 插入
def reconstruct_queue(people):
    ordered = sorted(people, key=lambda p: (-p[0], p[1]))  # 不改调用方输入
    res = []
    for p in ordered:
        res.insert(p[1], p)                   # 插到下标 k
    return res
```

**ACM 模板**
```python
import sys
from functools import cmp_to_key
def main():
    data = sys.stdin.read().split()
    n = int(data[0]); nums = data[1:1+n]      # 直接当字符串
    if not nums:
        print(''); return
    nums.sort(key=cmp_to_key(lambda a, b: (a+b < b+a) - (a+b > b+a)))
    res = ''.join(nums)
    print('0' if res[0] == '0' else res)
main()
```

**复杂度**:O(n log n)(cmp_to_key 常数略大)。

**典型题**:最大数、根据身高重建队列、按频率排序、区间调度(超纲篇模板 33)、合并区间。

**常见坑**
- 空输入先返回空串/输出空行,避免访问 `res[0]`。
- `cmp(a,b)` 返回值:负→a 在前,正→b 在前,0→相等;用 `(x<y)-(x>y)` 生成。
- 拼接最大数记得**全 0 特判**(`[0,0]` 结果是 `"0"` 不是 `"00"`)。
- Python3 没有 `sort(cmp=...)`,必须 `cmp_to_key` 包一层。

**口诀**:*两两比较看组合,cmp_to_key 转 key。*

---

## 44. 滑动窗口「恰好 K」计数(atMost 差分)

**识别信号**
- 「子数组/子串**恰好**满足 K 个某条件的**个数**」(恰好 K 个不同、恰好 K 个奇数；和恰好为 K 时仅限非负/二元数组能用“至多和”)。
- 直接求「恰好」难,但「至多 K」好求。

**为什么**
`恰好(K) = 至多(K) − 至多(K−1)`。前提是“至多 K”具有可伸缩单调性(右扩只会变坏、左缩只会变好)。不同元素个数、非负数组的和满足；含负数数组的和不满足，应改用前缀和频次。

**解题步骤**
1. 写 `at_most(m)`:滑动窗口统计「至多满足 m」的子数组个数(`res += right-left+1`)。
2. 答案 = `at_most(K) - at_most(K-1)`。

**Python 模板**
```python
# K 个不同整数的子数组(992)
def subarrays_with_k_distinct(nums, k):
    def at_most(m):
        if m < 0:
            return 0
        count = {}
        left = res = 0
        for right, x in enumerate(nums):
            count[x] = count.get(x, 0) + 1
            while len(count) > m:                 # 超了收缩左边界
                count[nums[left]] -= 1
                if count[nums[left]] == 0:
                    del count[nums[left]]
                left += 1
            res += right - left + 1               # 以 right 结尾的合法子数组数
        return res
    return at_most(k) - at_most(k - 1)

# 和为 K 的二元子数组(930,0/1 数组):和 <= K 用同样技巧
def num_subarrays_with_sum(nums, goal):
    def at_most(s):
        if s < 0: return 0
        left = res = cur = 0
        for right, x in enumerate(nums):
            cur += x
            while cur > s:
                cur -= nums[left]; left += 1
            res += right - left + 1
        return res
    return at_most(goal) - at_most(goal - 1)
```

**ACM 模板**
```python
import sys
def main():
    data = sys.stdin.read().split()
    n, k = int(data[0]), int(data[-1])
    nums = list(map(int, data[1:1+n]))
    def at_most(m):
        if m < 0: return 0
        cnt = {}; left = res = 0
        for right, x in enumerate(nums):
            cnt[x] = cnt.get(x,0)+1
            while len(cnt) > m:
                cnt[nums[left]] -= 1
                if cnt[nums[left]] == 0: del cnt[nums[left]]
                left += 1
            res += right-left+1
        return res
    print(at_most(k) - at_most(k-1))
main()
```

**复杂度**:时间 O(n)(两趟滑窗),空间 O(K)。

**典型题**:K 个不同整数的子数组、和为 K 的二元子数组、优美子数组(恰好 K 个奇数)、替换后的最长重复字符。

**常见坑**
- 只有「至多」单调可伸缩时才能用;「恰好」直接做往往不单调。
- 固定长度窗口是滚动和；可伸缩窗口才移动 left，二者不要混用。
- `at_most(k-1)` 当 k=0 要处理边界(`s<0` 返回 0)。
- 别忘最后是**相减**,不是直接返回 `at_most(k)`。

**口诀**:*恰好等于至多差,两趟滑窗相减得。*

---

# 📎 附录:浮点二分答案(补超纲篇模板 28)

超纲篇模板 28 只讲了**整数**二分答案;浮点二分更适合固定轮数,同时把单调方向和端点真假写进契约:

```python
def max_feasible_float(lo, hi, check, iterations=100):
    # 契约:check 单调 True -> False,check(lo)=True,check(hi)=False
    # 循环不变量:lo 始终可行、hi 始终不可行,答案夹在二者之间
    if lo >= hi or iterations <= 0 or not check(lo) or check(hi):
        raise ValueError("need feasible lo, infeasible hi, and positive iterations")
    for _ in range(iterations):
        mid = (lo + hi) / 2
        if check(mid):          # 最大化可行值:可行下界右移
            lo = mid
        else:
            hi = mid
    return lo                   # 返回仍可行的一侧,不会伪装成不可行答案

# 例:求 x 使某单调条件成立(如最大化平均值、最小化最大距离的浮点版)
# 若题目是找第一个可行值(False -> True),对称维护 lo 不可行、hi 可行并返回 hi
```

**要点**:① 先写清 `check` 的单调方向和两端真假,不满足契约就报错,不能直接返回一个貌似合理的边界;② 固定循环 100 次通常足够 double 精度;③ 输出用 `f'{ans:.6f}'` 控制小数位。

**口诀**:*浮点二分卡精度,循环百次最省心。*

---

# 🎯 提分补丁 v2 · 9 口诀速记

36. 记忆化:暴力递归加缓存,子问题只算一遍。
37. 二维前缀和:左上矩形先预处理,子矩阵和容斥求。
38. 价值背包:容量倒序防重选,选或不选取大者。
39. 进制字符串:进制先转十进制,字符串靠内置招式。
40. 区间 DP:小区间先算大后合,枚举分割点 k。
41. 树形 DP:子树返状态给父亲,选与不选合并算。
42. 逆序对:归并合并时计数,右小则左剩全逆。
43. 自定义排序:两两比较看组合,cmp_to_key 转 key。
44. 滑窗恰好 K:恰好等于至多差,两趟滑窗相减得。
---

原始文档：[GitHub 源文件](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/%E7%BA%AF%E5%8A%9B%E6%89%A3%E7%AE%97%E6%B3%95/%E5%BA%94%E8%AF%95/%E5%A4%A7%E5%8E%82%E7%AC%94%E8%AF%95%E6%8F%90%E5%88%86%E8%A1%A5%E4%B8%81v2.md)。
