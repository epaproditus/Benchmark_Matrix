#!/bin/bash
mysql --defaults-file=/home/abe/.projects/benchmark_matrix/my.cnf \
      --local-infile=1 \
      -u abe \
      -p'Antonieta.1' \
      benchmark -e "
LOAD DATA LOCAL INFILE '/home/abe/.projects/benchmark_matrix/dashboard/benspr.csv' 
INTO TABLE spring_benchmark 
FIELDS TERMINATED BY ',' 
LINES TERMINATED BY '\n' 
(LastName, FirstName, LocalId, Passed, Score, Points, Teacher);"
