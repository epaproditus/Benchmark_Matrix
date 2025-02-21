# Performance Matrix Dashboard Overview

## Core Components

### 1. Main Dashboard (/components/PerformanceMatrix.tsx)
- **Grade Level Filter**
  - Options:
    * "All Grades" (value: "")
    * "7th Grade" (value: "7")
    * "8th Grade" (value: "8")
  
  - Behavior:
    * Updates selectedGrade state
    * Resets selectedTeacher to null
    * Triggers fetchTeachers() and fetchData()
    * Affects both data display and teacher list
    * Automatically filters teacher dropdown
  
  - Database Logic:
    * Fall version: Uses separate tables (data7, data)
    * Spring versions: Uses single table (spring_matrix_data)
    * "All Grades" combines data using UNION ALL
    * Single grade uses WHERE Grade = ? filter

- **Version Filter**
  - Fall
    * Uses different tables: data7 (7th grade) and data (8th grade)
    * Shows fall semester benchmark and STAAR data
  - Spring (Regular)
    * Uses spring_matrix_data table
    * Excludes Algebra I students using filter: "NOT IN (SELECT LocalID FROM spralg1)"
  - Spring with Algebra I
    * Uses spring_matrix_data table
    * Includes all students (both regular and Algebra I)
    * No exclusion filter applied

- **Teacher Filter**
  - Database Query:
    * Uses `Benchmark Teacher` column from respective tables
    * Query Structure:
      ```sql
      SELECT DISTINCT `Benchmark Teacher` as teacher
      FROM ${tableName}
      WHERE `Benchmark Teacher` IS NOT NULL
      AND TRIM(`Benchmark Teacher`) != ''
      ORDER BY `Benchmark Teacher`
      ```
  
  - Table Selection:
    * Spring versions: Queries `spring_matrix_data`
    * Fall version: 
      - Grade 7: Queries `data7`
      - Grade 8: Queries `data`
      - All Grades: Uses UNION ALL to combine both tables
  
  - Behavior:
    * Dynamically updates based on grade level selection
    * Filters out NULL and empty teacher names
    * Returns alphabetically sorted list
    * Resets when grade level changes
    * Triggers data refresh when changed
    * "All Teachers" option available (value: "")

- **Additional Filters**
  - Grade Level (7th and 8th grade)
  - Teacher Selection (dynamically loaded based on grade and version)

### 2. Matrix Display and Calculations
- Matrix Layout:
  * Rows: STAAR Performance Levels
  * Columns: Benchmark Performance Levels
  * Row Totals: Sum of all cells in each row
  * Column Totals: Sum of all cells in each column
  * Grand Total: Calculated using `calculateGrandTotal()`
    - Iterates through all cells
    - Ensures consistency across all calculations
    - Used as denominator for Academic Growth Score

- Points System:
  * Base Points (1.0): Groups 35-31, 28-25, 21-19, 14-13, 8, 7, 1
  * Half Points (0.5): Groups 29, 22, 15
  * Quarter Points (0.25): Groups 34-31, 28-25 (DNM students only)
  * Zero Points: Groups 36, 30, 24-23, 18-16, 12-9, 6-2

- Academic Growth Score:
  ```typescript
  score = (totalPoints / calculateGrandTotal()) * 100
  ```
  * Uses consistent total from `calculateGrandTotal()`
  * Includes all point categories
  * Rounded to nearest whole number
  * Displayed with letter grade

- Cell Display:
  * Student count
  * Group number (if count > 0)
  * Color coding:
    - Green: Positive growth
    - Blue: Moderate progress
    - Red: Needs improvement

### 3. Data Management (/components/MissingData.tsx)
- Tracks missing assessment scores
- Allows manual data entry for:
  - Missing Benchmark scores
  - Missing STAAR scores

### 4. Database Integration
- Tables:
  - spring_matrix_data: Spring semester data
  - data7: 7th grade fall data
  - data: 8th grade fall data
  - spralg1: Algebra I student records

## Key Features
1. Real-time filtering and calculations
2. Student search functionality
3. Detailed student performance views
4. HB4545 compliance tracking
5. Score editing capability for missing data
6. Comprehensive performance metrics

## Recent Updates
1. Fixed grade level filter to dynamically show/disable options based on data availability
2. Added teacher grade level indicators in dropdown
3. Implemented consistent total calculations using `calculateGrandTotal()`
4. Fixed Academic Growth Score calculation to use proper denominator
5. Added data verification for spring vs spring-algebra selections

## Known Issues
1. ~~Grade level filter showing unavailable options~~ ✓ Fixed
2. ~~Teacher filter not respecting grade level selection~~ ✓ Fixed
3. ~~Matrix totals inconsistency~~ ✓ Fixed
4. ~~Academic Growth Score calculation using incorrect total~~ ✓ Fixed
