CREATE TABLE spring_benchmark_7 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    `Local Id` INT,                    -- Match data7 column name exactly
    `First Name` VARCHAR(255),         -- Match data7 column name and size
    `Last Name` VARCHAR(255),          -- Match data7 column name and size
    Score FLOAT,                       -- For the Score from CSV
    `Raw Score` FLOAT,                -- For the RawScore from CSV
    Teacher VARCHAR(255),              -- Match data7 size
    Passed VARCHAR(255),              -- Changed from BOOLEAN to match CSV format
    Below VARCHAR(255),               -- Changed from BOOLEAN to match CSV format
    Approaches VARCHAR(255),          -- Changed from BOOLEAN to match CSV format
    Meets VARCHAR(255),               -- Changed from BOOLEAN to match CSV format
    Masters VARCHAR(255),             -- Changed from BOOLEAN to match CSV format
    `Benchmark Performance` VARCHAR(255),  -- To match data7 naming convention
    `Combined Performance` VARCHAR(255),   -- Will be calculated after joining
    `Group #` INT,                        -- Will be calculated after joining
    CONSTRAINT fk_local_id 
        FOREIGN KEY (`Local Id`) 
        REFERENCES data7(`Local Id`)
);
