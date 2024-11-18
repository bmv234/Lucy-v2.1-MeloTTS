import random
import string
import time
from typing import Dict, Optional
from database import db

class SessionManager:
    def __init__(self):
        # Session expiry time (2 hours)
        self.session_expiry = 7200  # seconds

    def generate_code(self, length: int = 6) -> str:
        """Generate a random alphanumeric code."""
        return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))

    def create_teacher_session(self) -> Dict[str, str]:
        """Create a new teacher session with a unique code."""
        max_attempts = 5
        attempts = 0
        
        while attempts < max_attempts:
            teacher_code = self.generate_code()
            student_code = self.generate_code()
            
            # Try to create session in database
            if db.create_teacher_session(teacher_code, student_code):
                return {
                    "teacher_code": teacher_code,
                    "student_code": student_code
                }
            attempts += 1
            
        raise Exception("Failed to create unique session after multiple attempts")

    def validate_teacher_session(self, teacher_code: str) -> bool:
        """Validate a teacher session code."""
        # Clean up expired sessions
        db.cleanup_expired_sessions(self.session_expiry)
        
        # Validate session
        return db.validate_teacher_session(teacher_code)

    def validate_student_session(self, student_code: str) -> bool:
        """Validate a student session code."""
        # Clean up expired sessions
        db.cleanup_expired_sessions(self.session_expiry)
        
        # Validate session
        return db.validate_student_session(student_code)

    def get_session_codes(self, teacher_code: str) -> Optional[tuple]:
        """Get the teacher and student codes for a session."""
        return db.get_session_codes(teacher_code)

# Create global session manager instance
session_manager = SessionManager()
