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

### 2. Matrix Display
- Rows: STAAR Performance Levels
  - Did Not Meet Low
  - Did Not Meet High
  - Approaches Low
  - Approaches High
  - Meets
  - Masters

- Columns: Benchmark Performance Levels (same as rows)

- Cell Contents:
  - Student Count
  - Group Number
  - Color Coding:
    - Green: Positive growth
    - Blue: Moderate progress
    - Red: Needs improvement

- **Matrix Totals**
  - Cell Totals:
    * Shows count of students in each STAAR/Benchmark level combination
    * Displays group number (1-36)
    * Color-coded based on performance (red, blue, green)
  
  - Row Totals:
    * Right column shows total students per STAAR level
    * Sum of all cells in each row
  
  - Column Totals:
    * Bottom row shows total students per Benchmark level
    * Sum of all cells in each column
  
  - Overall Statistics:
    * Total Points:
      - 0.0 points: Sum of specific group numbers
      - 0.5 points: Sum of groups 29, 22, 15
      - 1.0 points: Sum of groups 35-31, 28-25, etc.
    * Academic Growth Score:
      - Calculated as (Total Points / Total Students) * 100
      - Displayed with corresponding letter grade
    * HB4545 Specific:
      - Separate matrix for "Did Not Meet" levels
      - Additional 0.25 point category for specific groups
      - Special intervention tracking calculations

- **Cell Click Interactions**
  - Modal Trigger:
    * Clicking any cell opens a modal overlay
    * Dark semi-transparent background (bg-black bg-opacity-50)
    * Centered positioning with max-width and scrollable content
  
  - Data Fetching:
    * Calls fetchStudentDetails() with cell data:
      - STAAR level
      - Benchmark level
      - Group number
      - Selected teacher (if any)
      - Selected grade
      - Current version
    
  - Modal Content:
    * Header: Shows selected STAAR/Benchmark levels
    * Student List Table:
      - First Name (clickable for detailed view)
      - Last Name
      - Grade
      - STAAR Score
      - Benchmark Score
      - Teacher
    * Close button (✕) in top-right corner
    
  - Secondary Interaction:
    * Clicking student's name opens assessment details
    * Shows individual question responses
    * Color-coded answers (green: correct, red: incorrect, yellow: unanswered)
    * Standards alignment for each question
    * Overall score and passing status

### 3. Data Management (/components/MissingData.tsx)
- Tracks missing assessment scores
- Allows manual data entry for:
  - Missing Benchmark scores
  - Missing STAAR scores

### 4. Calculations
- Academic Growth Score:
  - 0.0 points: Groups 36, 30, 24, 23, 18, 17, 16, 12, 11, 10, 9, 6, 5, 4, 3, 2
  - 0.5 points: Groups 29, 22, 15
  - 1.0 points: Groups 35, 34, 33, 32, 31, 28, 27, 26, 25, 21, 20, 19, 14, 13, 8, 7, 1

- Grade Scale:
  - A: 80+
  - B: 68-79
  - C: 61-67
  - D: 55-60
  - F: Below 55

### 5. Database Integration
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
