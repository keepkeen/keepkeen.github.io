---
title: "ACM 模式输入输出速查（Python）"
description: "覆盖快读、多组测试、EOF、树图构造和常见输出格式，避免算法会写却卡在 I/O。"
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
seriesOrder: 5
---
> 本文完整同步自个人求职工作区，更新于 2026-08-31。源文件及后续更新托管在 GitHub 仓库 [llm-algo-job-notes](https://github.com/keepkeen/llm-algo-job-notes)。

> 配套《Hot100 算法模板》使用。LeetCode 是「核心代码模式」——平台喂给你参数、你只写函数体;
> 而牛客 / ACM / 笔试多是「**ACM 模式**」——你要**自己从 stdin 读入、把结果 print 到 stdout**。
> 很多人算法会写却栽在「读入格式」上。这份文档专治读入输出,分三步:**选读法 → 套解析模板 → 选输出法**。

---

## 0. 一句话对比两种模式

| | LeetCode 核心代码模式 | ACM / 牛客自测模式 |
|---|---|---|
| 你写什么 | 只写 `class Solution` 里的函数 | 完整程序:读入 + 调用 + 打印 |
| 输入从哪来 | 平台注入参数 | `sys.stdin` / `input()` |
| 结果去哪 | `return` | `print` / `sys.stdout` |
| 本地怎么测 | 不方便 | `python sol.py < in.txt` |

**心法**:ACM 模式 = 「读入 → 建结构 → 调用你的算法 → 输出」四段式,算法部分和 LeetCode 一模一样,只在头尾包一层 I/O。

---

## 1. 三种读入方式,怎么选

```python
# 方式一:input() —— 一次读一行(返回不含换行的字符串)。少量数据、交互式最直观
line = input()                       # '1 2 3'
nums = list(map(int, input().split()))

# 方式二:sys.stdin.readline() —— 比 input() 快,读一行(注意末尾带 '\n',常配 .strip())
import sys
line = sys.stdin.readline().strip()

# 方式三:sys.stdin.read() —— 一次性把所有输入读成一个大字符串,最快。数据量大 / 不定行数首选
import sys
data = sys.stdin.read().split()      # 按任意空白(空格+换行)全拆成 token 列表
```

**选择原则**
- **不确定行数 / 数据量大(>1e5)** → `sys.stdin.read().split()`,一把梭最省心也最快。
- **格式严格按行、每行含义不同** → `sys.stdin.readline()` 逐行读。
- **数据很小、图省事** → `input()`。

> ⚠️ 大数据千万别用 `input()` 循环读,会超时。竞赛里 `input = sys.stdin.readline` 是常见提速写法。

---

## 2. 万能读入骨架(推荐背下来)

把所有输入当成一串 token,用一个游标 `idx` 往后取。**无论什么格式都能拆**:

```python
import sys

def main():
    data = sys.stdin.buffer.read().split()   # buffer 更快;元素是 bytes
    idx = 0
    def nxt():                                # 取下一个整数
        nonlocal idx
        v = int(data[idx]); idx += 1
        return v
    def nxt_str():                            # 取下一个字符串
        nonlocal idx
        v = data[idx].decode(); idx += 1
        return v

    n = nxt()                                 # 比如先读个数 n
    arr = [nxt() for _ in range(n)]           # 再读 n 个数
    # ... 你的算法 ...
    print(sum(arr))

main()
```

> `sys.stdin.buffer.read()` 读的是字节串,`int(b'123')` 能正常转;要当字符串用就 `.decode()`。追求极致速度用它,图省事用 `sys.stdin.read()`(返回 str)也行。

---

## 3. 按「输入格式」套解析模板

### 3.1 单个数 / 一行几个数
```
输入          解析
5             n = int(input())
1 2 3         a, b, c = map(int, input().split())
1 2 3 4 5     nums = list(map(int, input().split()))
```

### 3.2 第一行 n,第二行 n 个数(最常见)
```
输入:
5
3 1 4 1 5
```
```python
import sys
def main():
    data = sys.stdin.read().split()
    n = int(data[0])
    nums = list(map(int, data[1:1 + n]))
    print(sum(nums))
main()
```

### 3.3 第一行 n m,接下来 n 行每行 m 个(矩阵)
```
输入:
2 3
1 2 3
4 5 6
```
```python
import sys
def main():
    data = sys.stdin.read().split()
    idx = 0
    n, m = int(data[idx]), int(data[idx+1]); idx += 2
    grid = []
    for _ in range(n):
        grid.append(list(map(int, data[idx:idx+m]))); idx += m
    print(grid)
main()
```

### 3.4 多组测试数据:开头给组数 T
```
输入:
3
1 2
3 4
5 6
```
```python
import sys
def main():
    data = sys.stdin.read().split()
    idx = 0
    T = int(data[idx]); idx += 1
    out = []
    for _ in range(T):
        a, b = int(data[idx]), int(data[idx+1]); idx += 2
        out.append(str(a + b))
    print('\n'.join(out))      # 攒一起一次输出,比逐个 print 快
main()
```

### 3.5 多组数据:不给组数,读到文件结尾(EOF)
```
输入(直到 EOF):
1 2
3 4
5 6
```
```python
import sys
def main():
    out = []
    for line in sys.stdin:                 # 逐行读到 EOF
        line = line.strip()
        if not line:
            continue                        # 跳过空行
        a, b = map(int, line.split())
        out.append(str(a + b))
    print('\n'.join(out))
main()

# 等价写法:一把读完
# for a, b in zip(*[iter(map(int, sys.stdin.read().split()))]*2): ...
```

### 3.6 字符串 / 混合类型
```
输入:
3
alice 90
bob 85
carol 95
```
```python
import sys
def main():
    data = sys.stdin.read().split()
    idx = 0
    n = int(data[idx]); idx += 1
    people = []
    for _ in range(n):
        name = data[idx]; score = int(data[idx+1]); idx += 2
        people.append((name, score))
    people.sort(key=lambda p: -p[1])       # 按分数降序
    for name, score in people:
        print(name, score)
main()
```

> 读**整行含空格的字符串**(如一句话)不能用 `.split()` 拆,要用 `sys.stdin.readline().rstrip('\n')` 或 `input()` 整行拿。

---

## 4. 从输入构造数据结构(Hot100 高频)

LeetCode 直接给你 `ListNode` / `TreeNode`,ACM 模式要你**自己从数组/序列建出来**。背下这四个 `build`。

### 4.1 数组 → 链表
```
输入:1 2 3 4 5   →   1->2->3->4->5
```
```python
class ListNode:
    def __init__(self, val=0, nxt=None):
        self.val = val; self.next = nxt

def build_list(arr):
    dummy = tail = ListNode()
    for v in arr:
        tail.next = ListNode(v); tail = tail.next
    return dummy.next

def dump_list(head):                       # 链表 → 打印
    out = []
    while head:
        out.append(str(head.val)); head = head.next
    print(' '.join(out) if out else 'null')
```

### 4.2 层序数组 → 二叉树(`null` / `#` 表示空)
```
输入:1 2 3 null null 4 5   →   见 LeetCode 层序表示
```
```python
from collections import deque
class TreeNode:
    def __init__(self, v=0, l=None, r=None):
        self.val = v; self.left = l; self.right = r

def build_tree(tokens):                    # tokens: ['1','2','3','null',...]
    if not tokens or tokens[0] in ('null', '#'):
        return None
    root = TreeNode(int(tokens[0]))
    q = deque([root]); i = 1
    while q and i < len(tokens):
        node = q.popleft()
        if i < len(tokens) and tokens[i] not in ('null', '#'):
            node.left = TreeNode(int(tokens[i])); q.append(node.left)
        i += 1
        if i < len(tokens) and tokens[i] not in ('null', '#'):
            node.right = TreeNode(int(tokens[i])); q.append(node.right)
        i += 1
    return root
```

### 4.3 边列表 → 图(邻接表)
```
输入:
4 3            # 4 个点,3 条边
0 1
1 2
2 3
```
```python
def build_graph(n, edges, directed=False):
    g = [[] for _ in range(n)]
    for a, b in edges:
        g[a].append(b)
        if not directed:
            g[b].append(a)                 # 无向图两头都加
    return g
```

### 4.4 并查集初始化
```python
class DSU:
    def __init__(self, n):
        self.p = list(range(n))
    def find(self, x):
        while self.p[x] != x:
            self.p[x] = self.p[self.p[x]]; x = self.p[x]
        return x
    def union(self, a, b):
        self.p[self.find(a)] = self.find(b)
```

---

## 5. 输出写法(stdout)

```python
# 单个值
print(ans)

# 一维数组:空格分隔(最常用)
print(*nums)                        # 1 2 3 4   (* 解包,自动空格分隔)
print(' '.join(map(str, nums)))     # 同上,nums 是数字也能用

# 二维 / 多行:每行一组
for row in grid:
    print(*row)

# 大量行:先攒进 list,最后一次性输出(强烈推荐,快很多)
out = []
for x in data:
    out.append(str(x))
print('\n'.join(out))
# 或 sys.stdout.write('\n'.join(out) + '\n')

# 判定类:YES / NO、true / false
print('YES' if ok else 'NO')

# 浮点保留小数
print(f'{ans:.2f}')                 # 保留 2 位小数
print(round(ans, 6))                # 或 round

# 无解 / 空
print(-1)
print('null')
```

**核心提速原则**:**别在循环里一次次 `print`**。几万行输出时,逐个 print 会因频繁刷新 IO 严重变慢;正确做法是攒进列表,末尾 `'\n'.join` 一次打印。

---

## 6. 性能与常见坑(踩过就再也不忘)

| 坑 | 后果 | 正确做法 |
|---|---|---|
| 大数据用 `input()` 循环 | TLE 超时 | `sys.stdin.read()` 或 `input=sys.stdin.readline` |
| 循环里频繁 `print` | 输出慢到 TLE | 攒 `out` 列表,末尾 `'\n'.join` |
| 忘记 `.strip()` | 字符串带 `\n` 比较不相等 | `readline().strip()` |
| 递归深度大(树/DFS) | `RecursionError` 或进程直接崩溃(见下) | **优先改显式栈 / BFS**；仅在深度可控时适度调高限制 |
| 读入 token 数错位 | `IndexError` / 结果错 | 用游标 `idx` 或先 `read().split()` 全拆 |
| 整行含空格却 `split()` | 字符串被拆断 | 用 `readline().rstrip('\n')` 整行读 |
| 多组数据没读完 | 只算了第一组 | `for line in sys.stdin` 读到 EOF |

**竞赛常用开头**(按需添加):
```python
import sys
input = sys.stdin.readline          # 提速:后续 input() 都变快
# 只有已证明递归深度可控时才适度调高 recursionlimit；它不会增加 C 栈
# from math import inf  等按需导入
```

**⚠️ 递归深度真坑(Python 笔试头号翻车点)**

`sys.setrecursionlimit(...)` 只改变解释器的递归次数上限,**不会扩充进程的 C 栈**；设得很大仍可能让进程直接崩溃。新建线程的栈大小也依赖平台,默认并不保证更大,因此不能把「开线程」当深递归修复。安全顺序是:
1. 输入规模可能形成长链时,**先改迭代 / BFS**(树 DFS 用显式栈,链表递归改循环)。
2. 只有能证明最坏深度较小、只是略超默认上限时,才适度调高 `recursionlimit`,并在目标解释器实测。

```python
# 树/图遍历的安全骨架；需要后序时用 (node, parent, visited) 二次入栈
stack = [(start, -1)]
while stack:
    node, parent = stack.pop()
    for nxt in graph[node]:
        if nxt != parent:
            stack.append((nxt, node))
```

不要使用下面这种做法来“加大栈”:
```python
import sys, threading
sys.setrecursionlimit(1 << 25)
def main():
    ...            # 你的深递归逻辑放这里
threading.Thread(target=main).start()   # 默认线程栈不保证更大,仍可能崩溃
```

**部分分策略(大厂笔试按测试点给分,别放空)**
- 笔试多数题**过多少测试点给多少分**(≠ 全过才给分)。所以:**先写能过小数据的暴力 / 朴素解拿保底分**,再想优化。
- 一题卡住 20~25 分钟没思路 → **先交暴力、去做别的**,回头再优化。
- 常见「保底暴力」:能记忆化就记忆化(提分篇模板 36)、能 O(n²) 先 O(n²)、图论先跑朴素 BFS/DFS。
- 交之前**自测**:样例 + 空输入 + 单元素 + 最大规模,至少脑跑一遍边界。

---

## 7. 拿来即用·四段式终极模板

**任何 ACM 题都能套这个骨架**,只改中间「算法」一段:

```python
import sys

def solve(nums, target):
    # ===== 这里放你的算法(和 LeetCode 函数体一样)=====
    seen = {}
    for i, x in enumerate(nums):
        if target - x in seen:
            return [seen[target - x], i]
        seen[x] = i
    return [-1, -1]

def main():
    data = sys.stdin.read().split()     # ① 读入:全拆成 token
    idx = 0
    n = int(data[idx]); idx += 1        # ② 解析:按格式取值
    nums = [int(data[idx + i]) for i in range(n)]; idx += n
    target = int(data[idx]); idx += 1
    ans = solve(nums, target)           # ③ 调用算法
    print(*ans)                         # ④ 输出

main()
```

**完整可跑示例**(两数之和,存成 `sol.py`):
```python
# sol.py
import sys
def main():
    data = sys.stdin.read().split()
    n = int(data[0])
    nums = list(map(int, data[1:1 + n]))
    target = int(data[1 + n])
    seen = {}
    for i, x in enumerate(nums):
        if target - x in seen:
            print(seen[target - x], i); return
        seen[x] = i
    print(-1, -1)
main()
```
```
# in.txt
4
2 7 11 15
9
```
本地测试:`python sol.py < in.txt`  →  输出 `0 1`

---

## 8. 速查小结(一页流)

```
读入:
  少量        → input() / input().split()
  按行        → sys.stdin.readline().strip()
  大量/不定行 → sys.stdin.read().split()   ← 最通用,配游标 idx
  读到 EOF    → for line in sys.stdin

解析:
  n + 一行 n 个数     → data[0], data[1:1+n]
  n m + 矩阵          → 游标 idx 逐行切
  T 组数据           → 读 T,循环 T 次
  建链表/树/图        → 背 build_list / build_tree / build_graph

输出:
  数组     → print(*nums)
  多行     → out=[]; ... ; print('\n'.join(out))   ← 大量输出必用
  判定     → 'YES'/'NO'
  浮点     → f'{x:.2f}'

常用件:input=sys.stdin.readline / 攒 out 再打印；深遍历优先显式栈
```

> **一句话总结**:ACM 模式无非「`sys.stdin.read().split()` 全读进来 → 用游标 `idx` 按格式取 → 跑算法 → `print(*ans)` 或 `'\n'.join` 打出去」。算法照搬 LeetCode,I/O 套这套骨架即可。
---

原始文档：[GitHub 源文件](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/%E7%BA%AF%E5%8A%9B%E6%89%A3%E7%AE%97%E6%B3%95/%E5%BA%94%E8%AF%95/ACM%E8%BE%93%E5%85%A5%E8%BE%93%E5%87%BA%E9%80%9F%E6%9F%A5.md)。
