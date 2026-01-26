CREATE DATABASE IF NOT EXISTS benchmark;
USE benchmark;

-- Table: spring_matrix_data
CREATE TABLE IF NOT EXISTS spring_matrix_data (
    `First Name` VARCHAR(255),
    `Last Name` VARCHAR(255),
    `Local Id` VARCHAR(50) PRIMARY KEY,
    `Grade` VARCHAR(10),
    `Campus` VARCHAR(100),
    `Benchmark Teacher` VARCHAR(255),
    `STAAR MA07 Percent Score` FLOAT,
    `2024 STAAR Performance` VARCHAR(50),
    `Benchmark PercentScore` FLOAT,
    `2024-25 Benchmark Performance` VARCHAR(50),
    `Group #` INT
);

-- Table: rla_data7
CREATE TABLE IF NOT EXISTS rla_data7 (
    `FirstName` VARCHAR(255),
    `LastName` VARCHAR(255),
    `LocalId` VARCHAR(50) PRIMARY KEY,
    `Grade` VARCHAR(10),
    `Campus` VARCHAR(100),
    `Teacher` VARCHAR(255),
    `STAAR_Score` FLOAT,
    `STAAR_Performance` VARCHAR(50),
    `Benchmark_Score` FLOAT,
    `Benchmark_Performance` VARCHAR(50),
    `Group_Number` INT
);

-- Table: rla_data8
CREATE TABLE IF NOT EXISTS rla_data8 (
    `FirstName` VARCHAR(255),
    `LastName` VARCHAR(255),
    `LocalId` VARCHAR(50) PRIMARY KEY,
    `Grade` VARCHAR(10),
    `Campus` VARCHAR(100),
    `Teacher` VARCHAR(255),
    `STAAR_Score` FLOAT,
    `STAAR_Performance` VARCHAR(50),
    `Benchmark_Score` FLOAT,
    `Benchmark_Performance` VARCHAR(50),
    `Group_Number` INT
);

-- Table: spralg1
CREATE TABLE IF NOT EXISTS spralg1 (
    `Student` VARCHAR(255),
    `LocalID` VARCHAR(50) PRIMARY KEY,
    `Ethnicity` VARCHAR(100),
    `Passed` VARCHAR(10),
    `Below` VARCHAR(10),
    `Approaches` VARCHAR(10),
    `Meets` VARCHAR(10),
    `Masters` VARCHAR(10),
    `Score` FLOAT,
    `Raw Score` INT
);

-- Note: In a real scenario, we would use LOAD DATA LOCAL INFILE here.
-- Since the CSV headers might not perfectly match the SQL column names,
-- we'll suggest using a script or manual import if needed, but I'll provide the templates.

/*
LOAD DATA LOCAL INFILE '/Users/abe/projects/Benchmark_Matrix/dashboard/benspr.csv' 
INTO TABLE spring_matrix_data 
FIELDS TERMINATED BY ',' 
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES;
*/
