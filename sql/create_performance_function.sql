
DELIMITER //

CREATE FUNCTION calculate_performance_level(
    passed BOOLEAN,
    below BOOLEAN,
    approaches BOOLEAN,
    meets BOOLEAN,
    masters BOOLEAN
) RETURNS VARCHAR(20)
DETERMINISTIC
BEGIN
    DECLARE level_result VARCHAR(20);
    
    IF masters = TRUE THEN
        RETURN 'Masters';
    ELSEIF meets = TRUE THEN
        RETURN 'Meets';
    ELSEIF approaches = TRUE THEN
        RETURN 'Approaches High';
    ELSEIF below = TRUE THEN
        RETURN 'Did Not Meet High';
    ELSE
        RETURN 'Did Not Meet Low';
    END IF;
END //

DELIMITER ;
