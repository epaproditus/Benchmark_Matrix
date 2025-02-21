
CREATE TABLE spring_benchmark_7 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    LocalID VARCHAR(10),
    FirstName VARCHAR(50),
    LastName VARCHAR(50),
    Score INT,
    RawScore INT,
    Teacher VARCHAR(50),
    Passed BOOLEAN,
    Below BOOLEAN,
    Approaches BOOLEAN,
    Meets BOOLEAN,
    Masters BOOLEAN,
    performance_level VARCHAR(20),
    FOREIGN KEY (LocalID) REFERENCES data7(LocalID)
);
