<?php
session_start();
header('Content-Type: application/json');
require_once 'db_config.php';

$data = json_decode(file_get_contents("php://input"), true);
$username = $conn->real_escape_string($data['username'] ?? 'unknown');

$_SESSION['username'] = $username;
$_SESSION['login_time'] = date('Y-m-d H:i:s');

$sessionId = session_id();
$loginTime = $_SESSION['login_time'];

$stmt = $conn->prepare("INSERT INTO login_logs (username, login_time, session_id) VALUES (?, ?, ?)");
$stmt->bind_param("sss", $username, $loginTime, $sessionId);
$stmt->execute();

echo json_encode(["success" => true, "login_time" => $loginTime]);

$stmt->close();
$conn->close();
?>