import os
import sys

import pytest
from werkzeug.security import generate_password_hash

# Let pytest import app.py from the project root.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import app, db, User, Admin, Course, Selection, SemesterPass


@pytest.fixture
def client():
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"

    with app.app_context():
        db.drop_all()
        db.create_all()

        student = User(
            full_name="Test Student",
            email="student@example.com",
            student_id="24208028",
            password_hash=generate_password_hash("password123"),
        )

        # Admin is now its own model — no student_id, no ADMIN_EMAILS config needed.
        admin = Admin(
            full_name="Test Admin",
            email="admin@example.com",
            password_hash=generate_password_hash("admin123"),
        )

        # Semester 1 course
        course_sem1 = Course(
            code="CITS5505",
            name="Agile Web Development",
            credits=6,
            time="Monday 10:00–12:00",
            semester="semester1",
            degree="Master of Information Technology",
        )

        # Semester 2 course (used in semester-locking tests)
        course_sem2 = Course(
            code="CITS3003",
            name="Graphics",
            credits=6,
            time="Tuesday 09:00–10:00",
            semester="semester2",
            degree="Master of Information Technology",
        )

        # Semester 3 course (used in test_semester_3_locked)
        course_sem3 = Course(
            code="CITS301",
            name="Software Requirements",
            credits=6,
            time="Wednesday 09:00–10:00",
            semester="semester3",
            degree="Master of Information Technology",
        )

        db.session.add_all([student, admin, course_sem1, course_sem2, course_sem3])
        db.session.commit()

        with app.test_client() as test_client:
            yield test_client

        db.session.remove()
        db.drop_all()


def login_student(client):
    return client.post(
        "/",
        data={
            "email": "student@example.com",
            "password": "password123",
        },
        follow_redirects=True,
    )


def login_admin(client):
    # Admins have a dedicated login page.
    return client.post(
        "/admin-login",
        data={
            "email": "admin@example.com",
            "password": "admin123",
        },
        follow_redirects=True,
    )


def get_student_id(client):
    """Helper: return the test student's DB id from inside an app context."""
    with app.app_context():
        return User.query.filter_by(email="student@example.com").first().id


# ---------------------------------------------------------------------------
# Original tests (1-10) — kept intact, admin fixture now uses Admin model.
# ---------------------------------------------------------------------------

# Unit test 1: index page loads.
def test_index_page_loads(client):
    response = client.get("/")
    assert response.status_code == 200


# Unit test 2: signup page loads.
def test_signup_page_loads(client):
    response = client.get("/signup.html")
    assert response.status_code == 200


# Unit test 3: forgot password page loads.
def test_forgot_password_page_loads(client):
    response = client.get("/forgot-password")
    assert response.status_code == 200


# Unit test 4: reset password page loads.
def test_reset_password_page_loads(client):
    response = client.get("/reset-password")
    assert response.status_code == 200


# Unit test 5: student login works.
def test_student_login_redirects_to_homepage(client):
    response = login_student(client)
    assert response.status_code == 200
    assert b"dashboard" in response.data.lower()


# Unit test 6: course API requires login.
def test_course_api_requires_login(client):
    response = client.get("/api/courses", follow_redirects=True)
    assert response.status_code == 200
    assert b"sign" in response.data.lower() or b"login" in response.data.lower()


# Unit test 7: course API returns courses after login.
def test_course_api_returns_courses_after_login(client):
    login_student(client)

    response = client.get("/api/courses")
    data = response.get_json()

    assert response.status_code == 200
    assert "courses" in data
    assert any(c["code"] == "CITS5505" for c in data["courses"])


# Unit test 8: selected courses can be saved.
def test_save_selection_creates_selection(client):
    login_student(client)

    response = client.post(
        "/api/save-selection",
        json={
            "courses": ["CITS5505"],
            "degree": "Master of Information Technology",
        },
    )

    assert response.status_code == 200

    with app.app_context():
        saved_selection = Selection.query.first()
        assert saved_selection is not None


# Unit test 9: admin login works and lands on admin dashboard.
def test_admin_login_redirects_to_admin_dashboard(client):
    response = login_admin(client)

    assert response.status_code == 200
    assert b"admin" in response.data.lower()


# Unit test 10: student cannot access admin dashboard.
def test_student_cannot_access_admin_dashboard(client):
    login_student(client)

    response = client.get("/admin-dashboard.html", follow_redirects=True)

    assert response.status_code == 200
    assert b"dashboard" in response.data.lower()


# ---------------------------------------------------------------------------
# Semester progression tests (11-15)
# ---------------------------------------------------------------------------

# Unit test 11: Semester 1 is open by default — student can save sem1 courses.
def test_semester_1_open_by_default(client):
    login_student(client)

    response = client.post(
        "/api/save-selection",
        json={
            "courses": ["CITS5505"],
            "degree": "Master of Information Technology",
        },
    )

    assert response.status_code == 200
    data = response.get_json()
    assert "saved" in data.get("message", "").lower()


# Unit test 12: Semester 2 is locked until semester 1 is passed.
def test_semester_2_locked_until_semester_1_passed(client):
    login_student(client)

    response = client.post(
        "/api/save-selection",
        json={
            "courses": ["CITS3003"],          # semester 2 course
            "degree": "Master of Information Technology",
        },
    )

    # Backend must reject this with 403.
    assert response.status_code == 403
    data = response.get_json()
    # The error message should mention semester locking.
    error_msg = data.get("error", "").lower()
    assert "locked" in error_msg or "semester" in error_msg


# Unit test 13: Semester 2 becomes available after admin marks semester 1 passed.
def test_semester_2_available_after_semester_1_marked_passed(client):
    # Step 1 — student selects a sem1 course and confirms enrollment.
    login_student(client)

    client.post(
        "/api/save-selection",
        json={
            "courses": ["CITS5505"],
            "degree": "Master of Information Technology",
        },
    )
    client.post("/api/confirm-enrollment", json={})

    student_id = get_student_id(client)

    # Step 2 — admin marks semester 1 as passed.
    client.get("/logout", follow_redirects=True)
    login_admin(client)

    resp = client.post(
        f"/api/admin/mark-semester-passed/{student_id}",
        json={"semester_number": 1},
    )
    assert resp.status_code == 200

    # Step 3 — student logs back in and can now save a sem2 course.
    client.get("/logout", follow_redirects=True)
    login_student(client)

    response = client.post(
        "/api/save-selection",
        json={
            "courses": ["CITS3003"],          # semester 2 course
            "degree": "Master of Information Technology",
        },
    )

    assert response.status_code == 200


# Unit test 14: Admin mark-semester-passed creates a SemesterPass record and
# resets the student back to 'planning'.
def test_admin_mark_semester_passed_creates_record_and_resets_status(client):
    # Student enrols in semester 1.
    login_student(client)

    client.post(
        "/api/save-selection",
        json={
            "courses": ["CITS5505"],
            "degree": "Master of Information Technology",
        },
    )
    client.post("/api/confirm-enrollment", json={})

    student_id = get_student_id(client)

    # Admin marks semester 1 as passed.
    client.get("/logout", follow_redirects=True)
    login_admin(client)

    response = client.post(
        f"/api/admin/mark-semester-passed/{student_id}",
        json={"semester_number": 1},
    )

    assert response.status_code == 200
    data = response.get_json()
    assert "passed" in data.get("message", "").lower()
    assert data.get("next_eligible_semester") == 2

    # Verify SemesterPass record was created in the DB.
    with app.app_context():
        sp = SemesterPass.query.filter_by(
            user_id=student_id,
            semester_number=1,
        ).first()
        assert sp is not None, "SemesterPass record was not created."

        # Verify student enrollment_status was reset to 'planning'.
        student = User.query.get(student_id)
        assert student.enrollment_status == "planning"

        # Verify selections were cleared.
        remaining = Selection.query.filter_by(user_id=student_id).count()
        assert remaining == 0


# Unit test 15: Semester 3 remains locked even after semester 1 is passed
# (because semester 2 has not been passed yet).
def test_semester_3_locked_until_semester_2_passed(client):
    # Enrol and have semester 1 marked as passed.
    login_student(client)

    client.post(
        "/api/save-selection",
        json={
            "courses": ["CITS5505"],
            "degree": "Master of Information Technology",
        },
    )
    client.post("/api/confirm-enrollment", json={})

    student_id = get_student_id(client)

    client.get("/logout", follow_redirects=True)
    login_admin(client)
    client.post(
        f"/api/admin/mark-semester-passed/{student_id}",
        json={"semester_number": 1},
    )

    # Student is now eligible for semester 2 — but try to jump to semester 3.
    client.get("/logout", follow_redirects=True)
    login_student(client)

    response = client.post(
        "/api/save-selection",
        json={
            "courses": ["CITS301"],           # semester 3 course
            "degree": "Master of Information Technology",
        },
    )

    assert response.status_code == 403
    data = response.get_json()
    error_msg = data.get("error", "").lower()
    assert "locked" in error_msg or "semester" in error_msg