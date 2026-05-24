DELETE FROM user_roles WHERE role_id IN ('role_publisher', 'role_host');
DELETE FROM roles WHERE id IN ('role_publisher', 'role_host');
