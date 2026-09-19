USE expense_splitter;

-- 1. Group spending
SELECT g.group_name, b.budget_limit,
       COALESCE(SUM(e.amount),0) AS total_spent,
       ROUND(COALESCE(SUM(e.amount),0) / b.budget_limit * 100, 2) AS used_percent
FROM groups g
JOIN budgets b ON b.group_id = g.group_id
LEFT JOIN expenses e ON e.group_id = g.group_id
GROUP BY g.group_id, g.group_name, b.budget_limit;

-- 2. Expense history for a group
SELECT e.title, e.amount, e.expense_date, u.full_name AS paid_by,
       e.split_method
FROM expenses e
JOIN users u ON u.user_id = e.paid_by
WHERE e.group_id = ?
ORDER BY e.expense_date DESC;

-- 3. Member contribution / share
SELECT u.full_name,
       COALESCE(SUM(s.share_amount),0) AS total_share
FROM users u
JOIN splits s ON s.user_id = u.user_id
JOIN expenses e ON e.expense_id = s.expense_id
WHERE e.group_id = ?
GROUP BY u.user_id, u.full_name;

-- 4. Budget alerts
SELECT g.group_name, b.budget_limit,
       COALESCE(SUM(e.amount),0) AS spent,
       b.alert_threshold
FROM groups g
JOIN budgets b ON b.group_id = g.group_id
LEFT JOIN expenses e ON e.group_id = g.group_id
GROUP BY g.group_id, g.group_name, b.budget_limit, b.alert_threshold
HAVING spent >= budget_limit * alert_threshold / 100;
