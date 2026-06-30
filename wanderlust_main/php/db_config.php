<?php
$host = "localhost";
$user = "root";
$pass = "";
$dbname = "wanderlust_sessions";
$port = 3307;

$conn = new mysqli($host, $user, $pass, $dbname, $port);

if ($conn->connect_error) {
    die(json_encode(["error" => "Database connection failed: " . $conn->connect_error]));
}
?>