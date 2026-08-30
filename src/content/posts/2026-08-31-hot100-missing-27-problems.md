---
title: "LeetCode Hot100 · 缺失 27 题完整补充"
description: "补齐两份算法模板中尚无独立代码的 27 道官方 Hot100 题，形成完整 100 题复习卡。"
date: 2026-08-31
updatedDate: 2026-08-31
tags:
  - algorithms
  - leetcode
  - interview
featured: false
draft: false
lang: zh-CN
series: algorithm-exam-training
seriesOrder: 3
---
> 本文完整同步自个人求职工作区，更新于 2026-08-31。源文件及后续更新托管在 GitHub 仓库 [llm-algo-job-notes](https://github.com/keepkeen/llm-algo-job-notes)。

> 本文补齐《Hot100 算法模板与决策术》和《Hot100 补充篇》中尚无独立代码的 27 道官方 Hot100 题。代码采用 LeetCode 核心函数形式，链表和树节点类型由平台提供。

## 11. 盛最多水的容器

**题目卡**：给定若干竖线的高度，选择两条线与横轴组成容器，求能盛水的最大面积。

```python
def max_area(height):
    left, right = 0, len(height) - 1
    best = 0
    while left < right:
        best = max(best, (right - left) * min(height[left], height[right]))
        if height[left] <= height[right]:
            left += 1
        else:
            right -= 1
    return best
```

## 239. 滑动窗口最大值

**题目卡**：给定数组和窗口大小 k，返回窗口从左向右移动时每个位置的最大值。

```python
from collections import deque

def max_sliding_window(nums, k):
    queue = deque()  # 下标单调递减队列
    answer = []
    for right, value in enumerate(nums):
        while queue and queue[0] <= right - k:
            queue.popleft()
        while queue and nums[queue[-1]] <= value:
            queue.pop()
        queue.append(right)
        if right >= k - 1:
            answer.append(nums[queue[0]])
    return answer
```

## 56. 合并区间

**题目卡**：给定若干区间，合并所有重叠区间并返回互不重叠的结果。

```python
def merge_intervals(intervals):
    if not intervals:
        return []
    intervals = sorted(intervals)
    merged = [intervals[0][:]]
    for start, end in intervals[1:]:
        if start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return merged
```

## 160. 相交链表

**题目卡**：给定两个单链表的头节点，找出它们开始相交的节点；若不相交则返回空。

```python
def get_intersection_node(head_a, head_b):
    a, b = head_a, head_b
    while a is not b:
        a = a.next if a else head_b
        b = b.next if b else head_a
    return a
```

## 234. 回文链表

**题目卡**：判断一个单链表的节点值序列是否为回文，并在判断后恢复链表。

```python
def is_palindrome(head):
    if not head or not head.next:
        return True
    slow = fast = head
    while fast.next and fast.next.next:
        slow = slow.next
        fast = fast.next.next

    prev, cur = None, slow.next
    while cur:
        cur.next, prev, cur = prev, cur, cur.next
    second_head = prev

    left, right = head, second_head
    result = True
    while right:
        if left.val != right.val:
            result = False
            break
        left, right = left.next, right.next

    prev, cur = None, second_head
    while cur:
        cur.next, prev, cur = prev, cur, cur.next
    slow.next = prev
    return result
```

## 141. 环形链表

**题目卡**：判断单链表中是否存在环。

```python
def has_cycle(head):
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
        if slow is fast:
            return True
    return False
```

## 142. 环形链表 II

**题目卡**：若单链表存在环，返回环的入口节点；否则返回空。

```python
def detect_cycle_entry(head):
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
        if slow is fast:
            break
    else:
        return None
    finder = head
    while finder is not slow:
        finder = finder.next
        slow = slow.next
    return finder
```

## 2. 两数相加

**题目卡**：两个链表以逆序数字表示非负整数，返回它们相加后的逆序链表。

```python
def add_two_numbers(l1, l2):
    dummy = tail = ListNode(0)
    carry = 0
    while l1 or l2 or carry:
        total = carry
        if l1:
            total += l1.val
            l1 = l1.next
        if l2:
            total += l2.val
            l2 = l2.next
        carry, digit = divmod(total, 10)
        tail.next = ListNode(digit)
        tail = tail.next
    return dummy.next
```

## 148. 排序链表

**题目卡**：在 O(n log n) 时间内将单链表按升序排列。

```python
def sort_list(head):
    if not head or not head.next:
        return head

    slow, fast = head, head.next
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
    right = slow.next
    slow.next = None
    left = sort_list(head)
    right = sort_list(right)

    dummy = tail = ListNode(0)
    while left and right:
        if left.val <= right.val:
            tail.next, left = left, left.next
        else:
            tail.next, right = right, right.next
        tail = tail.next
    tail.next = left or right
    return dummy.next
```

## 23. 合并 K 个升序链表

**题目卡**：合并 k 个升序链表，返回一条升序链表。

```python
import heapq

def merge_k_lists(lists):
    heap = []
    serial = 0
    for node in lists:
        if node:
            heapq.heappush(heap, (node.val, serial, node))
            serial += 1
    dummy = tail = ListNode(0)
    while heap:
        _, _, node = heapq.heappop(heap)
        tail.next = node
        tail = node
        if node.next:
            heapq.heappush(heap, (node.next.val, serial, node.next))
            serial += 1
    return dummy.next
```

## 226. 翻转二叉树

**题目卡**：交换二叉树中每个节点的左右子树，并返回根节点。

```python
def invert_tree(root):
    if not root:
        return None
    root.left, root.right = invert_tree(root.right), invert_tree(root.left)
    return root
```

## 199. 二叉树的右视图

**题目卡**：返回从二叉树右侧观察时从上到下能看到的节点值。

```python
from collections import deque

def right_side_view(root):
    if not root:
        return []
    queue, answer = deque([root]), []
    while queue:
        level_size = len(queue)
        for i in range(level_size):
            node = queue.popleft()
            if node.left:
                queue.append(node.left)
            if node.right:
                queue.append(node.right)
            if i == level_size - 1:
                answer.append(node.val)
    return answer
```

## 124. 二叉树中的最大路径和

**题目卡**：二叉树中的路径可从任意节点开始和结束，求所有非空路径的最大节点值之和。

```python
def max_path_sum(root):
    best = float("-inf")

    def gain(node):
        nonlocal best
        if not node:
            return 0
        left = max(gain(node.left), 0)
        right = max(gain(node.right), 0)
        best = max(best, node.val + left + right)
        return node.val + max(left, right)

    gain(root)
    return best
```

## 22. 括号生成

**题目卡**：给定括号对数 n，生成所有有效的括号组合。

```python
def generate_parenthesis(n):
    answer = []

    def dfs(path, opened, closed):
        if len(path) == 2 * n:
            answer.append("".join(path))
            return
        if opened < n:
            path.append("(")
            dfs(path, opened + 1, closed)
            path.pop()
        if closed < opened:
            path.append(")")
            dfs(path, opened, closed + 1)
            path.pop()

    dfs([], 0, 0)
    return answer
```

## 131. 分割回文串

**题目卡**：将字符串分割成若干子串，使每个子串都是回文串，返回所有分割方案。

```python
def partition_palindromes(s):
    answer, path = [], []

    def is_palindrome(left, right):
        while left < right:
            if s[left] != s[right]:
                return False
            left += 1
            right -= 1
        return True

    def dfs(start):
        if start == len(s):
            answer.append(path[:])
            return
        for end in range(start, len(s)):
            if is_palindrome(start, end):
                path.append(s[start:end + 1])
                dfs(end + 1)
                path.pop()

    dfs(0)
    return answer
```

## 51. N 皇后

**题目卡**：在 n×n 棋盘放置 n 个皇后，使其互不攻击，返回所有不同布局。

```python
def solve_n_queens(n):
    answer, queens = [], []
    columns, diagonals1, diagonals2 = set(), set(), set()

    def dfs(row):
        if row == n:
            board = []
            for col in queens:
                board.append("." * col + "Q" + "." * (n - col - 1))
            answer.append(board)
            return
        for col in range(n):
            if col in columns or row - col in diagonals1 or row + col in diagonals2:
                continue
            queens.append(col)
            columns.add(col); diagonals1.add(row - col); diagonals2.add(row + col)
            dfs(row + 1)
            queens.pop()
            columns.remove(col); diagonals1.remove(row - col); diagonals2.remove(row + col)

    dfs(0)
    return answer
```

## 74. 搜索二维矩阵

**题目卡**：矩阵每行递增且下一行首元素大于上一行尾元素，判断目标值是否存在。

```python
def search_matrix_flat(matrix, target):
    if not matrix or not matrix[0]:
        return False
    rows, cols = len(matrix), len(matrix[0])
    left, right = 0, rows * cols
    while left < right:
        mid = (left + right) // 2
        value = matrix[mid // cols][mid % cols]
        if value < target:
            left = mid + 1
        else:
            right = mid
    return left < rows * cols and matrix[left // cols][left % cols] == target
```

## 34. 在排序数组中查找元素的第一个和最后一个位置

**题目卡**：在非递减数组中以 O(log n) 时间返回目标值的起始和结束下标。

```python
def search_range(nums, target):
    def lower_bound(value):
        left, right = 0, len(nums)
        while left < right:
            mid = (left + right) // 2
            if nums[mid] < value:
                left = mid + 1
            else:
                right = mid
        return left

    left = lower_bound(target)
    right = lower_bound(target + 1) - 1
    if left == len(nums) or nums[left] != target:
        return [-1, -1]
    return [left, right]
```

## 153. 寻找旋转排序数组中的最小值

**题目卡**：在元素互不相同的旋转升序数组中，以 O(log n) 时间找出最小值。

```python
def find_min_rotated(nums):
    left, right = 0, len(nums) - 1
    while left < right:
        mid = (left + right) // 2
        if nums[mid] > nums[right]:
            left = mid + 1
        else:
            right = mid
    return nums[left]
```

## 4. 寻找两个正序数组的中位数

**题目卡**：给定两个正序数组，在 O(log(m+n)) 时间内求合并后的中位数。

```python
def find_median_sorted_arrays(nums1, nums2):
    if len(nums1) > len(nums2):
        nums1, nums2 = nums2, nums1
    m, n = len(nums1), len(nums2)
    left, right = 0, m
    half = (m + n + 1) // 2
    while left <= right:
        i = (left + right) // 2
        j = half - i
        a_left = nums1[i - 1] if i else float("-inf")
        a_right = nums1[i] if i < m else float("inf")
        b_left = nums2[j - 1] if j else float("-inf")
        b_right = nums2[j] if j < n else float("inf")
        if a_left > b_right:
            right = i - 1
        elif b_left > a_right:
            left = i + 1
        else:
            if (m + n) % 2:
                return max(a_left, b_left)
            return (max(a_left, b_left) + min(a_right, b_right)) / 2
    raise ValueError("Input arrays must be sorted")
```

## 394. 字符串解码

**题目卡**：解码形如 k[encoded_string] 的字符串，其中括号可以嵌套。

```python
def decode_string(s):
    stack = []
    current, number = "", 0
    for char in s:
        if char.isdigit():
            number = number * 10 + int(char)
        elif char == "[":
            stack.append((current, number))
            current, number = "", 0
        elif char == "]":
            prefix, repeat = stack.pop()
            current = prefix + current * repeat
        else:
            current += char
    return current
```

## 70. 爬楼梯

**题目卡**：每次可以爬1或2级台阶，求到达第 n 级共有多少种不同方法。

```python
def climb_stairs(n):
    previous, current = 0, 1
    for _ in range(n):
        previous, current = current, previous + current
    return current
```

## 139. 单词拆分

**题目卡**：判断字符串能否由字典中的一个或多个单词拼接而成，字典单词可重复使用。

```python
def word_break(s, word_dict):
    words = set(word_dict)
    max_length = max(map(len, words), default=0)
    reachable = [False] * (len(s) + 1)
    reachable[0] = True
    for end in range(1, len(s) + 1):
        start_min = max(0, end - max_length)
        for start in range(start_min, end):
            if reachable[start] and s[start:end] in words:
                reachable[end] = True
                break
    return reachable[-1]
```

## 152. 乘积最大子数组

**题目卡**：给定整数数组，求乘积最大的非空连续子数组的乘积。

```python
def max_product(nums):
    current_max = current_min = answer = nums[0]
    for value in nums[1:]:
        if value < 0:
            current_max, current_min = current_min, current_max
        current_max = max(value, current_max * value)
        current_min = min(value, current_min * value)
        answer = max(answer, current_max)
    return answer
```

## 32. 最长有效括号

**题目卡**：给定只含左右括号的字符串，求最长有效连续括号子串的长度。

```python
def longest_valid_parentheses(s):
    stack = [-1]
    best = 0
    for index, char in enumerate(s):
        if char == "(":
            stack.append(index)
        else:
            stack.pop()
            if not stack:
                stack.append(index)
            else:
                best = max(best, index - stack[-1])
    return best
```

## 62. 不同路径

**题目卡**：机器人只能向右或向下移动，求从 m×n 网格左上角到右下角的不同路径数。

```python
def unique_paths(m, n):
    dp = [1] * n
    for _ in range(1, m):
        for col in range(1, n):
            dp[col] += dp[col - 1]
    return dp[-1]
```

## 1143. 最长公共子序列

**题目卡**：给定两个字符串，求它们最长公共子序列的长度。

```python
def longest_common_subsequence(text1, text2):
    if len(text1) < len(text2):
        text1, text2 = text2, text1
    dp = [0] * (len(text2) + 1)
    for char1 in text1:
        diagonal = 0
        for j, char2 in enumerate(text2, 1):
            above = dp[j]
            if char1 == char2:
                dp[j] = diagonal + 1
            else:
                dp[j] = max(dp[j], dp[j - 1])
            diagonal = above
    return dp[-1]
```
---

原始文档：[GitHub 源文件](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/%E7%BA%AF%E5%8A%9B%E6%89%A3%E7%AE%97%E6%B3%95/%E5%9F%BA%E7%A1%80/Hot100%E7%BC%BA%E5%A4%B127%E9%A2%98%C2%B7Kindle%E8%A1%A5%E5%85%85.md)。
