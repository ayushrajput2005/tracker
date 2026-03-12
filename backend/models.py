from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    username      = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)

    assignments = relationship("Assignment", back_populates="owner", cascade="all, delete")
    sessions    = relationship("Session",    back_populates="owner", cascade="all, delete")


class Session(Base):
    __tablename__ = "sessions"

    id      = Column(Integer, primary_key=True, index=True)
    token   = Column(String, unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    owner = relationship("User", back_populates="sessions")


class Assignment(Base):
    __tablename__ = "assignments"

    id       = Column(Integer, primary_key=True, index=True)
    title    = Column(String, nullable=False)
    subject  = Column(String, nullable=False)
    due_date = Column(String, nullable=False)
    done     = Column(Boolean, default=False)
    user_id  = Column(Integer, ForeignKey("users.id"), nullable=False)

    owner = relationship("User", back_populates="assignments")
