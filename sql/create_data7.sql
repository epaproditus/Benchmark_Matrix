CREATE TABLE data7 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    LocalID VARCHAR(10) UNIQUE,
    FirstName VARCHAR(50),
    LastName VARCHAR(50),
    Grade VARCHAR(2),
    Teacher VARCHAR(50),
    staar_score INT,
    benchmark_score INT,
    staar_level VARCHAR(20),
    benchmark_level VARCHAR(20),
    group_number INT
);
