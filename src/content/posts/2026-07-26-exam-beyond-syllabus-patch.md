---
title: "大厂笔试超纲补丁（模板 28–35）"
description: "Hot100 覆盖不到、但字节/美团/华为/拼多多笔试高频的考点：第 3–4 题靠这里，全部给出可直接运行的 ACM 骨架。"
date: 2026-07-26
tags:
  - algorithms
  - leetcode
  - interview
featured: false
draft: false
lang: zh-CN
series: llm-algo-job-hunt
seriesOrder: 9
---

> 本文是个人求职工作区文档的发布版，最后核验 2026-07-26。文档源文件与可运行模板、测试托管在 GitHub 仓库 [llm-algo-job-notes](https://github.com/keepkeen/llm-algo-job-notes)；文中所有面经均为公开帖子的转述，证据分级见正文说明。

> 面向:**能做简单题 → 冲国内大厂笔试**。这里收录的是 **Hot100 覆盖不到、但字节/美团/华为/拼多多笔试高频**的考点。
> 大厂笔试 = **ACM 模式(自读 stdin)+ 3~5 题难度递增 + 部分分制**。前 2 题靠 Hot100 Medium,**第 3~4 题就靠本篇**。
> 每篇仍是 9 件套。所有 ACM 模板都可 `python x.py < in.txt` 直接跑。

## 本篇总览

| # | 考点 | 一句话触发条件 | 优先级 |
|---|------|----------------|--------|
| 28 | 二分答案 | 「最大值最小 / 最小值最大 / 能否在 x 下完成」 | ⭐⭐⭐ 必背 |
| 29 | 差分数组 | 「区间批量加减」「多次区间修改后查最终值」 | ⭐⭐⭐ 必背 |
| 30 | 最短路 Dijkstra / 0-1 BFS | 「带权图求最短距离 / 最小代价」 | ⭐⭐⭐ 必背 |
| 31 | 快速幂 + 取模 | 「结果对 1e9+7 取模」「求 a^b」 | ⭐⭐⭐ 必背 |
| 32 | 数论基础 | GCD/LCM、判质数、质数筛、质因数分解 | ⭐⭐ 高频 |
| 33 | 区间调度贪心 | 「最多不重叠区间 / 最少箭 / 会议室」 | ⭐⭐ 高频 |
| 34 | 单调队列 | 「定长滑动窗口的最大/最小值」 | ⭐⭐ 高频 |
| 35 | 模拟题套路 | 「读懂一大段规则,按步骤实现」 | ⭐⭐ 高频(华为/美团) |

> **一周时间分配建议**:28–31 必须吃透(占笔试难题的一大半);32–35 有时间就过。文末列了「一周不建议碰」的考点,别浪费时间。

---

## 28. 二分答案(在答案空间上二分)

**识别信号**
- 「**最大值最小化 / 最小值最大化**」「求满足条件的**最小/最大**的那个值」。
- 「能否在容量/时间/速度 = x 的条件下完成?」且这个「能否」随 x **单调**(x 越大越容易/越难)。
- 关键词:最小速度、最大间距、最少天数、最小的最大负载、分割数组。

**为什么**
虽然数组本身无序,但「答案」有单调性:如果 x 可行,那 x+1 也可行(或反之)。于是**在答案的取值范围 [lo, hi] 上二分**,用一个 `check(x)` 判定可行性,把「求最优值」变成「找可行/不可行的分界点」。

**解题步骤**
1. 确定答案范围 `lo, hi`(最小可能值、最大可能值)。
2. 写 `check(x)`:在「限制 = x」下能否满足要求(通常 O(n) 扫一遍)。
3. 二分找**第一个可行**(最小化)或**最后一个可行**(最大化)的 x。

**Python 模板**
```python
# 通法:最小化「最大值」——找第一个可行的 x
def min_feasible(lo, hi, check):
    while lo < hi:
        mid = (lo + hi) // 2
        if check(mid):        # mid 可行 → 尝试更小
            hi = mid
        else:
            lo = mid + 1
    return lo

# 例:爱吃香蕉的珂珂——h 小时吃完的最小速度
def min_eating_speed(piles, h):
    def check(k):
        return sum((p + k - 1) // k for p in piles) <= h   # 向上取整求小时数
    lo, hi = 1, max(piles)
    while lo < hi:
        mid = (lo + hi) // 2
        if check(mid): hi = mid
        else: lo = mid + 1
    return lo

# 例:分割数组的最大值最小(把数组分成 m 段,最小化各段和的最大值)
def split_array(nums, m):
    def check(cap):                      # 每段和不超过 cap,能否分成 <= m 段
        cnt, cur = 1, 0
        for x in nums:
            if cur + x > cap:
                cnt += 1; cur = 0
            cur += x
        return cnt <= m
    lo, hi = max(nums), sum(nums)
    while lo < hi:
        mid = (lo + hi) // 2
        if check(mid): hi = mid
        else: lo = mid + 1
    return lo
```

**ACM 模板**
```python
import sys
def main():
    data = sys.stdin.read().split()
    n, h = int(data[0]), int(data[1])
    piles = list(map(int, data[2:2 + n]))
    def check(k):
        return sum((p + k - 1) // k for p in piles) <= h
    lo, hi = 1, max(piles)
    while lo < hi:
        mid = (lo + hi) // 2
        if check(mid): hi = mid
        else: lo = mid + 1
    print(lo)
main()
```

**复杂度**:O(n · log(值域))。check 一般 O(n),二分 log(hi-lo) 次。

**典型题**:爱吃香蕉的珂珂、在 D 天内送达包裹的最低运力、分割数组的最大值、最小化最大距离、制作 m 束花所需最少天数。

**常见坑**
- 先想清是「找第一个可行」还是「最后一个可行」,模板的 `hi=mid` / `lo=mid+1` 别写反。
- `lo, hi` 边界要能覆盖真实答案(hi 取 `sum` 或 `max`,别取小了)。
- `check` 里向上取整用 `(p+k-1)//k`,别用浮点。

**口诀**:*最大最小求分界,答案空间上二分。*

---

## 29. 差分数组(区间批量修改的逆前缀和)

**识别信号**
- 「对区间 `[l, r]` 整体加 val」这类操作**做很多次**,最后才查询数组的最终形态。
- 「多个航班/时间段叠加」「区间覆盖计数」「n 个操作后求每个位置的值」。

**为什么**
朴素做法每次区间修改 O(n),m 次就 O(nm)。差分数组把「区间修改」变成**两个端点的单点修改**:`d[l]+=val, d[r+1]-=val`,最后对 `d` 求一次前缀和就还原出结果,总复杂度 O(n+m)。差分是前缀和的逆运算。

**解题步骤**
1. 建差分数组 `d`(长度 n+1,防越界)。
2. 每个区间操作 `[l,r]+val`:`d[l]+=val; d[r+1]-=val`。
3. 对 `d` 求前缀和,得到每个位置的最终值。

**Python 模板**
```python
def apply_range_updates(n, ops):
    # ops: [(l, r, val), ...] 对闭区间 [l,r] 都加 val
    d = [0] * (n + 1)
    for l, r, val in ops:
        d[l] += val
        d[r + 1] -= val          # r+1 处抵消,所以开 n+1
    res, cur = [], 0
    for i in range(n):
        cur += d[i]              # 前缀和还原
        res.append(cur)
    return res

# 二维差分(矩阵区间加)——大厂偶尔考
def diff_2d(rows, cols, ops):
    d = [[0]*(cols+1) for _ in range(rows+1)]
    for r1, c1, r2, c2, val in ops:      # 左上(r1,c1)到右下(r2,c2)
        d[r1][c1] += val
        d[r1][c2+1] -= val
        d[r2+1][c1] -= val
        d[r2+1][c2+1] += val
    # 二维前缀和还原
    for i in range(rows):
        for j in range(cols):
            up   = d[i-1][j] if i else 0
            left = d[i][j-1] if j else 0
            ul   = d[i-1][j-1] if i and j else 0
            d[i][j] += up + left - ul
    return [row[:cols] for row in d[:rows]]
```

**ACM 模板**
```python
import sys
def main():
    data = sys.stdin.read().split()
    idx = 0
    n, m = int(data[idx]), int(data[idx+1]); idx += 2
    d = [0]*(n+1)
    for _ in range(m):
        l, r, val = int(data[idx]), int(data[idx+1]), int(data[idx+2]); idx += 3
        d[l] += val; d[r+1] -= val
    out, cur = [], 0
    for i in range(n):
        cur += d[i]; out.append(str(cur))
    print(' '.join(out))
main()
```

**复杂度**:m 次区间修改 + 一次还原 = O(n + m)。

**典型题**:航班预订统计、拼车(判断能否完成)、区间加法后求最大值、一维/二维区间覆盖。

**常见坑**
- `d` 要开 `n+1` 长度,`d[r+1]` 才不越界。
- 差分只适合「先批量改、最后统一查」;如果「边改边查任意区间」要用树状数组/线段树。
- 下标从 0 还是 1 开始,`r+1` 的位置要对应好。

**口诀**:*区间加变两端点,差分还原前缀和。*

---

## 30. 最短路:Dijkstra / 0-1 BFS

**识别信号**
- 「带权图求两点间最短距离 / 最小花费 / 最小时间」,**边权非负**。
- 「网格里每步代价不同,求到终点最小代价」。
- 边权只有 0 和 1 → 用 **0-1 BFS**(双端队列),比 Dijkstra 更快。

**为什么**
无权图用普通 BFS 就够;一旦**边有不同权重**,BFS 的「层 = 距离」不成立,要用 **Dijkstra**:每次从「已知最短的未确定点」向外扩,用小顶堆快速取最小。边权只有 0/1 时,0 权边放队头、1 权边放队尾,普通双端队列即可替代堆。

**解题步骤(Dijkstra)**
1. `dist[]` 初始化 INF,`dist[src]=0`,起点入小顶堆 `(0, src)`。
2. 弹出堆顶(当前最短);若是过期记录(`d > dist[u]`)跳过。
3. 松弛所有邻边:`dist[u]+w < dist[v]` 就更新并入堆。

**Python 模板**
```python
import heapq
# Dijkstra 堆优化(邻接表 graph[u] = [(v, w), ...])
def dijkstra(n, graph, src):
    INF = float('inf')
    dist = [INF] * n
    dist[src] = 0
    pq = [(0, src)]
    while pq:
        d, u = heapq.heappop(pq)
        if d > dist[u]:
            continue                       # 过期记录,跳过
        for v, w in graph[u]:
            nd = d + w
            if nd < dist[v]:
                dist[v] = nd
                heapq.heappush(pq, (nd, v))
    return dist

# 0-1 BFS(边权只有 0/1):双端队列,0 权头进、1 权尾进
from collections import deque
def zero_one_bfs(n, graph, src):
    INF = float('inf')
    dist = [INF] * n
    dist[src] = 0
    dq = deque([src])
    while dq:
        u = dq.popleft()
        for v, w in graph[u]:              # w ∈ {0, 1}
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                if w == 0:
                    dq.appendleft(v)
                else:
                    dq.append(v)
    return dist
```

**ACM 模板**
```python
import sys, heapq
def main():
    data = sys.stdin.read().split()
    idx = 0
    n, m = int(data[idx]), int(data[idx+1]); idx += 2
    graph = [[] for _ in range(n)]
    for _ in range(m):
        u, v, w = int(data[idx]), int(data[idx+1]), int(data[idx+2]); idx += 3
        graph[u].append((v, w))
        graph[v].append((u, w))            # 无向图再加反向;有向图删掉这行
    INF = float('inf'); dist = [INF]*n; dist[0] = 0
    pq = [(0, 0)]
    while pq:
        d, u = heapq.heappop(pq)
        if d > dist[u]: continue
        for v, w in graph[u]:
            if d + w < dist[v]:
                dist[v] = d + w; heapq.heappush(pq, (dist[v], v))
    print(' '.join(str(x) if x != INF else '-1' for x in dist))
main()
```

**复杂度**:Dijkstra 堆优化 O((n+m) log n);0-1 BFS O(n+m)。

**典型题**:网络延迟时间、到达目标的最小花费、最小体力消耗路径(网格)、概率最大路径。`K` 站中转内最便宜航班必须把「已用边数」加入状态,不能直接套本节的一维 `dist` 模板。

**常见坑**
- Dijkstra **只适用非负权**;有负权要用 Bellman-Ford / SPFA。
- 有「最多 K 步/站」约束时,最短路状态至少要包含 `(节点,已用步数)`,或改用分层 Bellman-Ford。
- 一定要判「过期记录」`if d > dist[u]: continue`,否则堆里旧值会拖慢甚至出错。
- 无向图建边要**双向**都加。

**口诀**:*带权最短用堆扩,松弛跳过过期值。*

---

## 31. 快速幂 + 取模(大数幂与模运算)

**识别信号**
- 题目要求「结果对 `1e9+7`(或 `998244353`)取模」。
- 求 `a^b`,其中 b 极大(如 1e9),普通循环会超时。
- 关键词:方案数取模、大指数、矩阵快速幂(进阶)。

**为什么**
`a^b` 直接乘要 O(b) 次;快速幂利用 `a^b = (a^(b/2))^2` 把指数每次砍半,O(log b) 搞定。取模是因为计数类答案会爆 long,题目让你全程 `% MOD` 保持数值可控(Python 虽不溢出但会变超大整数拖慢,取模同样必要)。

**解题步骤**
1. `res=1`,把 `b` 看成二进制。
2. 从低位到高位:当前位是 1 就 `res = res*a % mod`;每步 `a = a*a % mod`,`b >>= 1`。
3. 循环到 `b==0`,`res` 即答案。

**Python 模板**
```python
MOD = 10**9 + 7

# 快速幂:a^b % mod
def qpow(a, b, mod=MOD):
    res = 1
    a %= mod
    while b:
        if b & 1:
            res = res * a % mod
        a = a * a % mod
        b >>= 1
    return res

# 逆元(费马小定理,mod 为质数时):a 的逆元 = a^(mod-2)
def inv(a, mod=MOD):
    return qpow(a, mod - 2, mod)

# 组合数取模 C(n, k) % mod(预处理阶乘)——大厂计数题常用
def comb_mod(n, k, mod=MOD):
    if k < 0 or k > n:
        return 0
    fac = [1] * (n + 1)
    for i in range(1, n + 1):
        fac[i] = fac[i - 1] * i % mod
    return fac[n] * inv(fac[k], mod) % mod * inv(fac[n - k], mod) % mod
```

**ACM 模板**
```python
import sys
def main():
    a, b = map(int, sys.stdin.read().split())
    MOD = 10**9 + 7
    res, a = 1, a % MOD
    while b:
        if b & 1: res = res * a % MOD
        a = a * a % MOD; b >>= 1
    print(res)
main()
```

**复杂度**:O(log b)。组合数预处理 O(n)。

**典型题**:Pow(x,n)(LeetCode 50)、超级次方、各类「方案数 mod 1e9+7」的计数 DP、组合数取模。

**常见坑**
- Python 内置 `pow(a, b, mod)` **就是快速幂**,笔试可直接用 `pow(2, 100000, MOD)`!但要会手写原理以防被要求。
- 逆元法求组合数**要求 mod 是质数**(1e9+7 是),否则用扩展欧几里得。
- 全程 `% mod`,别只在最后取一次(中间会爆成大整数拖慢)。

**口诀**:*指数砍半平方乘,取模逆元费马幂。*

---

## 32. 数论基础(GCD / 质数筛 / 质因数)

**识别信号**
- 出现「最大公约数、最小公倍数、互质、约数个数」。
- 「判断质数、找 ≤ n 的所有质数、质因数分解」。
- 送分题或中档题里的数学小工具。

**为什么**
这些是数论的「乐高积木」,笔试里常作为大题的一个子步骤。背熟模板能 30 秒解决,现推容易翻车(尤其筛法的复杂度)。

**解题步骤**:直接套模板,记住「欧几里得求 gcd」「埃氏筛 O(n log log n)」。

**Python 模板**
```python
from math import gcd            # Python 自带 gcd,直接用
def lcm(a, b):
    return a // gcd(a, b) * b   # 先除再乘防溢出

# 判质数 O(√n)
def is_prime(n):
    if n < 2:
        return False
    i = 2
    while i * i <= n:
        if n % i == 0:
            return False
        i += 1
    return True

# 埃氏筛:求 [2, n] 所有质数
def sieve(n):
    is_p = [True] * (n + 1)
    is_p[0] = is_p[1] = False
    for i in range(2, int(n ** 0.5) + 1):
        if is_p[i]:
            for j in range(i * i, n + 1, i):   # 从 i*i 开始
                is_p[j] = False
    return [i for i in range(2, n + 1) if is_p[i]]

# 质因数分解
def factorize(n):
    factors = {}
    d = 2
    while d * d <= n:
        while n % d == 0:
            factors[d] = factors.get(d, 0) + 1
            n //= d
        d += 1
    if n > 1:
        factors[n] = factors.get(n, 0) + 1   # 剩下的大质数
    return factors
```

**ACM 模板**
```python
import sys
def main():
    n = int(sys.stdin.readline())
    is_p = [True]*(n+1)
    is_p[0] = is_p[1] = False
    for i in range(2, int(n**0.5)+1):
        if is_p[i]:
            for j in range(i*i, n+1, i): is_p[j] = False
    print(*[i for i in range(2, n+1) if is_p[i]])
main()
```

**复杂度**:gcd O(log)、判质数 O(√n)、埃氏筛 O(n log log n)、分解 O(√n)。

**常见坑**
- 埃氏筛内层从 `i*i` 开始(小于 i*i 的已被更小质数筛过)。
- `lcm` 先除后乘防溢出:`a//gcd*b` 而非 `a*b//gcd`。
- 质因数分解最后 `if n>1` 别忘(剩下的是个大质数)。

**口诀**:*辗转相除求 gcd,埃氏筛法标合数。*

---

## 33. 区间调度贪心(排序 + 扫描)

**识别信号**
- 「最多能选多少个**互不重叠**的区间」「最少用几支箭引爆气球」「会议室能否全排下 / 需要几个会议室」。
- 「按某个维度排序后,贪心地选/合并」。

**为什么**
区间问题的贪心核心:**按右端点排序**,每次选「结束最早」的,给后面留最多空间——这样能选的区间最多。这是可证明的经典贪心。

**解题步骤(最多不重叠区间)**
1. 按**右端点**升序排序。
2. 维护上一个选中区间的右端 `end`。
3. 当前区间左端 `≥ end` 就选它,更新 `end`。

**Python 模板**
```python
# 最多不重叠区间数(等价:最少删除数 = n - 该值)
def max_non_overlap(intervals):
    intervals.sort(key=lambda x: x[1])        # 按右端点排
    cnt, end = 0, float('-inf')
    for s, e in intervals:
        if s >= end:                          # 不重叠,选它
            cnt += 1
            end = e
    return cnt

# 合并区间(56,按左端点排)
def merge(intervals):
    intervals.sort(key=lambda x: x[0])
    res = []
    for s, e in intervals:
        if res and s <= res[-1][1]:
            res[-1][1] = max(res[-1][1], e)   # 有重叠,合并
        else:
            res.append([s, e])
    return res

# 需要多少个会议室(最大重叠数):差分/扫描线思想
def min_meeting_rooms(intervals):
    events = []
    for s, e in intervals:
        events.append((s, 1))     # 开始 +1
        events.append((e, -1))    # 结束 -1
    events.sort()                 # 同时刻:结束(-1)排在开始(+1)前
    cur = best = 0
    for _, delta in events:
        cur += delta
        best = max(best, cur)
    return best
```

**ACM 模板**
```python
import sys
def main():
    data = sys.stdin.read().split()
    n = int(data[0])
    intervals = [(int(data[1+2*i]), int(data[2+2*i])) for i in range(n)]
    intervals.sort(key=lambda x: x[1])
    cnt, end = 0, float('-inf')
    for s, e in intervals:
        if s >= end: cnt += 1; end = e
    print(cnt)
main()
```

**复杂度**:排序 O(n log n) + 扫描 O(n)。

**典型题**:无重叠区间、用最少数量的箭引爆气球、合并区间、会议室 I/II、划分字母区间。

**常见坑**
- 「最多不重叠」按**右端点**排;「合并区间」按**左端点**排——别搞混。
- 边界「相邻算不算重叠」看题意:`[1,2]` 和 `[2,3]` 有时算重叠有时不算,`>=` 还是 `>` 要对应。

**口诀**:*不重叠按右端排,合并区间按左端。*

---

## 34. 单调队列(定长窗口最值)

**识别信号**
- 「滑动窗口(**定长 k**)里的**最大值/最小值**」,要求 O(n)。
- 「窗口内最值」反复出现在 DP 优化里(单调队列优化 DP)。

**为什么**
定长窗口求最值,朴素每窗 O(k) 共 O(nk)。单调队列(双端队列存下标)维护一个「单调递减」序列:队头永远是当前窗口最大值,新元素把比它小的队尾全弹掉,每个元素进出各一次 → O(n)。

**解题步骤(求最大值)**
1. 队列存**下标**,对应值单调递减。
2. 新元素入队前,把队尾比它小的都弹掉(它们不可能再当最大)。
3. 队头下标若滑出窗口(`≤ i-k`)就弹掉;窗口成形后队头即答案。

**Python 模板**
```python
from collections import deque
# 239 滑动窗口最大值
def max_sliding_window(nums, k):
    dq = deque()          # 存下标,nums[下标] 单调递减
    res = []
    for i, x in enumerate(nums):
        while dq and nums[dq[-1]] <= x:
            dq.pop()                      # 弹掉队尾更小的
        dq.append(i)
        if dq[0] <= i - k:
            dq.popleft()                  # 队头滑出窗口
        if i >= k - 1:
            res.append(nums[dq[0]])       # 窗口成形,队头是最大
    return res
```

**ACM 模板**
```python
import sys
from collections import deque
def main():
    data = sys.stdin.read().split()
    n, k = int(data[0]), int(data[1])
    nums = list(map(int, data[2:2 + n]))
    dq, res = deque(), []
    for i, x in enumerate(nums):
        while dq and nums[dq[-1]] <= x: dq.pop()
        dq.append(i)
        if dq[0] <= i - k: dq.popleft()
        if i >= k - 1: res.append(nums[dq[0]])
    print(*res)
main()
```

**复杂度**:时间 O(n),空间 O(k)。

**典型题**:滑动窗口最大值(239,也在 Hot100)、绝对差不超过限制的最长子数组、跳跃游戏 VI(单调队列优化 DP)。

**常见坑**
- 队列存**下标**不是值(要靠下标判断是否滑出窗口)。
- 求最大值维护**递减**队列(弹掉更小的);求最小值反过来。
- 判滑出用 `dq[0] <= i-k`,收集答案用 `i >= k-1`,两个边界别错。

**口诀**:*定长窗口求最值,单调队列存下标。*

---

## 35. 模拟题套路(读懂规则,稳扎稳打)

**识别信号**
- 题目是**一大段规则/流程描述**,没有明显算法名,让你「按题意实现」。
- 华为机试、美团笔试的第 1~2 题常是这种「劝退式长题面」。
- 关键词:游戏规则、日期处理、字符串格式化、状态机、报数、约瑟夫环。

**为什么**
简单模拟主要考**代码组织能力 + 细心**;复杂模拟还会考状态设计、事件优先级、同步/异步更新和周期快进。双陆棋、角色移动等题不能只靠“照题意写”硬堆条件。

**解题步骤(方法论,不是算法)**
1. 列出完整状态，以及每轮 `validate → transition → resolve → score` 的阶段顺序。
2. 明确冲突规则、并列规则和更新是读旧状态还是边算边改；需要同步更新时先写入新状态。
3. 每个阶段写一个不变量断言，状态尽量可序列化，便于判环、快进和复现失败。
4. 用样例手动走阶段快照，再写非法动作、并列、循环状态等边界样例。

**Python 模板(通用骨架 + 常用小工具)**
```python
# 状态机 / 分步模拟的通用骨架
def simulate(steps):
    state = init_state()
    for step in steps:
        state = apply_rule(state, step)   # 每条规则一个函数
    return format_output(state)

# —— 笔试常用小工具 ——
# 约瑟夫环(n 人围圈,每数到 m 出局,求最后幸存者,0-indexed)
def josephus(n, m):
    ans = 0
    for i in range(2, n + 1):
        ans = (ans + m) % i
    return ans                             # 要 1-indexed 就 +1

# 日期:两个日期相差天数,直接用标准库最稳
from datetime import date
def days_between(y1, m1, d1, y2, m2, d2):
    return abs((date(y2, m2, d2) - date(y1, m1, d1)).days)

# 二维方向模拟(上右下左循环,螺旋/机器人行走常用)
DIRS = [(-1, 0), (0, 1), (1, 0), (0, -1)]  # 顺时针
def turn_right(d):
    return (d + 1) % 4
```

**ACM 模板**(以「按规则处理 n 条指令」为例)
```python
import sys
def main():
    data = sys.stdin.read().split()
    idx = 0
    n = int(data[idx]); idx += 1
    x = y = 0                              # 例:机器人在网格移动
    d = 0                                  # 朝向
    DIRS = [(-1,0),(0,1),(1,0),(0,-1)]
    for _ in range(n):
        cmd = data[idx]; idx += 1
        if cmd == 'L': d = (d + 3) % 4
        elif cmd == 'R': d = (d + 1) % 4
        else:                              # 'F' 前进
            dx, dy = DIRS[d]; x += dx; y += dy
    print(x, y)
main()
```

**复杂度**:通常就是 O(步数),关键不在复杂度而在**正确性**。

**典型题**:约瑟夫环、螺旋矩阵、机器人行走、日期计算、字符串大数加减、报数游戏、简单状态机。

**常见坑**
- **题意读错**是最大杀手——一定用样例验证再提交。
- 大整数加减、进位、前导零这类细节最容易漏。
- 别怕代码长,模拟题**拆清楚函数**比追求简短重要。

**口诀**:*长题面别慌张,拆规则分函数,样例走一遍。*

---

# 📎 附录 A:大厂笔试应试策略(临场提分)

1. **先扫全部题,按「好拿分」排序做**,不一定从第 1 题开始。前面 AC 的分最稳。
2. **部分分制**:一道 Hard 全 AC 难,但过 30%~60% 测试点(暴力/小数据解)也有分——**别放空**。
3. **数据范围反推算法**(务必形成本能):
   - n ≤ 20 → 状压/回溯;n ≤ 2000 → O(n²);n ≤ 1e5 → O(n log n);n ≤ 1e6 → O(n)。
4. **Python 防 TLE 三件套**:`sys.stdin.read()` 快读、攒 `out` 列表 `'\n'.join` 快写、`pow(a,b,mod)` 用内置。
5. **卡题就跳**:一题超过 20~25 分钟没思路,先拿下别的,回头再啃。
6. **提交前自测**:样例 + 空输入 + 单元素 + 最大规模,至少脑跑一遍边界。

# 📎 附录 B:一周时间,这些「别碰」(性价比低)

若只剩一周且目标是通用技术卷,以下内容可以暂缓；**目标算法岗/算法专场时必须按公司证据调整**:

- **线段树 / 树状数组进阶**:通用卷可先学 Fenwick;目标阿里/算法专场至少掌握单点更新与区间查询，27 届公开回忆已出现线段树建模。
- **数位 DP / 状压 DP**:难且冷门,投入产出比低。
- **KMP / 后缀数组 / AC 自动机**:字符串高级算法,大厂笔试极少;`str.find` / 字符串哈希够用。
- **网络流 / 二分图匹配**:通用卷低频，但算法岗已出现最小权完美匹配；目标阿里时至少会识别并掌握 Hungarian O(n³)。

> 通用卷一周突击仍优先 Hot100 Medium + 28–31 + 计时模拟；算法岗应再按[作战手册](/blog/algo-written-exam-playbook/)和[组合题决策树](/blog/exam-pattern-decision-tree/)选择公司专项。

# 🎯 超纲篇 8 口诀速记

28. 二分答案:最大最小求分界,答案空间上二分。
29. 差分数组:区间加变两端点,差分还原前缀和。
30. 最短路:带权最短用堆扩,松弛跳过过期值。
31. 快速幂:指数砍半平方乘,取模逆元费马幂。
32. 数论:辗转相除求 gcd,埃氏筛法标合数。
33. 区间贪心:不重叠按右端排,合并区间按左端。
34. 单调队列:定长窗口求最值,单调队列存下标。
35. 模拟题:长题面别慌张,拆规则分函数,样例走一遍。
