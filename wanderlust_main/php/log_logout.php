<?php
session_start();
header('Content-Type: application/json');
require_once 'db_config.php';

$sessionId = session_id();
$logoutTime = date('Y-m-d H:i:s');

$stmt = $conn->prepare("UPDATE login_logs SET logout_time = ? WHERE session_id = ? AND logout_time IS NULL ORDER BY id DESC LIMIT 1");
$stmt->bind_param("ss", $logoutTime, $sessionId);
$stmt->execute();

echo json_encode(["success" => true, "logout_time" => $logoutTime]);

session_unset();
session_destroy();

$stmt->close();
$conn->close();
?>