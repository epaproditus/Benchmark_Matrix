DROP TABLE IF EXISTS spring7_benchmark;

CREATE TABLE spring7_benchmark (
    id INT AUTO_INCREMENT PRIMARY KEY,
    Student VARCHAR(255),
    LocalID INT,
    Ethnicity VARCHAR(255),
    Passed VARCHAR(3),
    Below VARCHAR(3),
    Approaches VARCHAR(3),
    Meets VARCHAR(3),
    Masters VARCHAR(3),
    Score INT,
    `Raw Score` INT,
    Teacher VARCHAR(255)
);
