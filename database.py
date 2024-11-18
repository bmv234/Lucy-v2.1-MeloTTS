import sqlite3
import time
from contextlib import contextmanager

class Database:
    def __init__(self):
        self.db_path = 'sessions.db'
        self._init_db()

    def _init_db(self):
        """Initialize the database with required tables."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Create teacher sessions table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS teacher_sessions (
                    teacher_code TEXT PRIMARY KEY,
                    student_code TEXT UNIQUE,
                    created_at REAL,
                    last_accessed REAL
                )
            ''')
            
            # Create student sessions table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS student_sessions (
                    student_code TEXT PRIMARY KEY,
                    teacher_code TEXT,
                    created_at REAL,
                    last_accessed REAL,
                    FOREIGN KEY (teacher_code) REFERENCES teacher_sessions (teacher_code)
                )
            ''')

            # Create session data table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS session_data (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    teacher_code TEXT,
                    transcription TEXT,
                    translation TEXT,
                    timestamp REAL,
                    FOREIGN KEY (teacher_code) REFERENCES teacher_sessions (teacher_code)
                )
            ''')
            
            conn.commit()

    @contextmanager
    def get_connection(self):
        """Context manager for database connections."""
        conn = sqlite3.connect(self.db_path)
        try:
            yield conn
        finally:
            conn.close()

    def create_teacher_session(self, teacher_code: str, student_code: str) -> bool:
        """Create a new teacher session."""
        current_time = time.time()
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO teacher_sessions 
                    (teacher_code, student_code, created_at, last_accessed)
                    VALUES (?, ?, ?, ?)
                ''', (teacher_code, student_code, current_time, current_time))
                conn.commit()
                return True
        except sqlite3.IntegrityError:
            return False

    def validate_teacher_session(self, teacher_code: str) -> bool:
        """Validate and update a teacher session."""
        current_time = time.time()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE teacher_sessions 
                SET last_accessed = ?
                WHERE teacher_code = ?
                RETURNING student_code
            ''', (current_time, teacher_code))
            result = cursor.fetchone()
            return bool(result)

    def validate_student_session(self, student_code: str) -> bool:
        """Validate and update a student session."""
        current_time = time.time()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Check if student code exists in teacher sessions
            cursor.execute('''
                SELECT teacher_code 
                FROM teacher_sessions 
                WHERE student_code = ?
            ''', (student_code,))
            teacher_result = cursor.fetchone()
            
            if not teacher_result:
                return False
                
            teacher_code = teacher_result[0]
            
            # Update teacher session access time
            cursor.execute('''
                UPDATE teacher_sessions 
                SET last_accessed = ?
                WHERE teacher_code = ?
            ''', (current_time, teacher_code))
            
            # Create or update student session
            cursor.execute('''
                INSERT INTO student_sessions 
                (student_code, teacher_code, created_at, last_accessed)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(student_code) DO UPDATE SET
                last_accessed = excluded.last_accessed
            ''', (student_code, teacher_code, current_time, current_time))
            
            conn.commit()
            return True

    def get_session_codes(self, teacher_code: str) -> tuple:
        """Get student code for a teacher session."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT student_code
                FROM teacher_sessions
                WHERE teacher_code = ?
            ''', (teacher_code,))
            result = cursor.fetchone()
            return (teacher_code, result[0]) if result else None

    def get_teacher_code_for_student(self, student_code: str) -> str:
        """Get teacher code for a student session."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT teacher_code
                FROM teacher_sessions
                WHERE student_code = ?
            ''', (student_code,))
            result = cursor.fetchone()
            return result[0] if result else None

    def store_session_data(self, teacher_code: str, transcription: str, translation: str) -> bool:
        """Store transcription and translation data for a session."""
        current_time = time.time()
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO session_data 
                    (teacher_code, transcription, translation, timestamp)
                    VALUES (?, ?, ?, ?)
                ''', (teacher_code, transcription, translation, current_time))
                conn.commit()
                return True
        except sqlite3.Error:
            return False

    def get_session_data(self, teacher_code: str) -> list:
        """Get all transcription and translation data for a session."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT transcription, translation
                FROM session_data
                WHERE teacher_code = ?
                ORDER BY timestamp ASC
            ''', (teacher_code,))
            return cursor.fetchall()

    def clear_session_data(self, teacher_code: str) -> bool:
        """Clear all data for a session."""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    DELETE FROM session_data
                    WHERE teacher_code = ?
                ''', (teacher_code,))
                conn.commit()
                return True
        except sqlite3.Error:
            return False

    def cleanup_expired_sessions(self, expiry_time: float):
        """Remove expired sessions and their data."""
        current_time = time.time()
        expiry_threshold = current_time - expiry_time
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Delete session data for expired sessions
            cursor.execute('''
                DELETE FROM session_data
                WHERE teacher_code IN (
                    SELECT teacher_code
                    FROM teacher_sessions
                    WHERE last_accessed < ?
                )
            ''', (expiry_threshold,))
            
            # Delete expired student sessions
            cursor.execute('''
                DELETE FROM student_sessions
                WHERE teacher_code IN (
                    SELECT teacher_code
                    FROM teacher_sessions
                    WHERE last_accessed < ?
                )
            ''', (expiry_threshold,))
            
            # Get and delete expired teacher sessions
            cursor.execute('''
                SELECT teacher_code
                FROM teacher_sessions
                WHERE last_accessed < ?
            ''', (expiry_threshold,))
            expired_teachers = [row[0] for row in cursor.fetchall()]
            
            cursor.execute('''
                DELETE FROM teacher_sessions
                WHERE last_accessed < ?
            ''', (expiry_threshold,))
            
            conn.commit()
            return len(expired_teachers)

# Create global database instance
db = Database()
