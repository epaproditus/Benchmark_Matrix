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

## Recent Updates (Latest First)

1. Fixed Campus View Grade Filtering
   - Now properly combines both Math and RLA data for single grade selections
   - Uses WITH clause for better query organization
   - Maintains correct group numbers and performance levels
   - Includes proper ordering of performance levels

2. Fixed Data Handling Issues
   - Added null checks for staarTotals data
   - Added default empty array fallbacks
   - Improved error handling in data reduction
   - Added type safety for database responses

3. Query Improvements
   - Optimized grade-specific campus view queries
   - Added proper CAST for numeric calculations
   - Improved JOIN conditions for data consistency
   - Added proper ordering for performance levels

## Current Status

### Campus View Functionality
- Grade Level Filtering:
  * 7th Grade: Shows combined Math and RLA data from spring7_matrix_view and rla_data7
  * 8th Grade: Shows combined Math and RLA data from spring_matrix_data and rla_data8
  * All Grades: Shows combined data from all tables

- Version Support:
  * Spring (Regular & Algebra): Full support
  * Fall: Not available for campus view

### Data Handling
- Robust null checking
- Default values for undefined data
- Type-safe data transformations
- Proper error handling

## Known Issues
1. ~~Grade level filter showing unavailable options~~ ✓ Fixed
2. ~~Teacher filter not respecting grade level selection~~ ✓ Fixed
3. ~~Matrix totals inconsistency~~ ✓ Fixed
4. ~~Academic Growth Score calculation using incorrect total~~ ✓ Fixed

## API Documentation

### Endpoints

1. `/api/matrix`
   - Used for matrix data and student details
   - **GET**: Fetch matrix summary data
     ```typescript
     // Example request
     const response = await fetch('/api/matrix?grade=7&teacher=Smith&version=spring&subject=math');
     const data = await response.json();
     // Returns: { matrixData: [], staarTotals: [] }
     ```
   - **POST**: Search students or get cell details
     ```markdown
     POST /api/matrix
     body: { search: "student_local_id" }
     ```
     ```typescript
     // Search students
     const searchResponse = await fetch('/api/matrix', {
       method: 'POST',
       body: JSON.stringify({
         search: 'John',
         grade: '7',
         teacher: 'Smith',
         version: 'spring',
         subject: 'math'
       })
     });

     // Get cell details
     const cellResponse = await fetch('/api/matrix', {
       method: 'POST',
       body: JSON.stringify({
         staar_level: 'Meets',
         benchmark_level: 'Masters',
         group_number: 15,
         grade: '7',
         teacher: 'Smith',
         version: 'spring',
         subject: 'math'
       })
     });
     ```

2. `/api/teachers`
   - Get available teachers
   ```typescript
   const response = await fetch('/api/teachers?grade=7&version=spring&subject=math');
   const data = await response.json();
   // Returns: { teachers: [{ name: string, grade: string }], gradeHasData: boolean }
   ```

3. `/api/grades`
   - Get available grades
   ```typescript
   const response = await fetch('/api/grades?version=spring');
   const data = await response.json();
   // Returns: { grades: string[], hasData: { [grade: string]: boolean } }
   ```

4. `/api/assessments`
   - Get student assessment details
   ```typescript
   const response = await fetch('/api/assessments?localId=12345');
   const data = await response.json();
   // Returns: { assessments: [] }
   ```

5. `/api/missing-data`
   - Manage missing student data
   - **GET**: List students with missing scores
   - **POST**: Update missing scores
   ```typescript
   // Update scores
   const response = await fetch('/api/missing-data', {
     method: 'POST',
     body: JSON.stringify({
       localId: '12345',
       benchmarkScore: 85,
       staarScore: 90
     })
   });
   ```

### Query Parameters

1. `version`
   - `fall`: Fall semester data
   - `spring`: Spring without Algebra I
   - `spring-algebra`: Spring with Algebra I included

2. `subject`
   - `math`: Mathematics only
   - `rla`: Reading Language Arts only
   - `campus`: Combined view (spring versions only)

3. `grade`
   - `7`: 7th grade only
   - `8`: 8th grade only
   - empty: All grades

4. `teacher`
   - Filter by teacher name
   - Leave empty for all teachers

### Database Tables

1. Math Data Tables:
   - `spring_matrix_data`: Main spring data
   - `spring7_matrix_view`: 7th grade spring view
   - `data7`: 7th grade fall data
   - `data`: 8th grade fall data
   - `spralg1`: Algebra I records

2. RLA Data Tables:
   - `rla_data7`: 7th grade RLA data
   - `rla_data8`: 8th grade RLA data

### Example Usage

## Cross-Application Integration

### Student Data Integration
Applications can connect using the shared student identifier `Local Id` which is used consistently across all tables and applications.

### API Integration Example
