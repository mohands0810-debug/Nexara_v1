from pydantic import BaseModel
from typing import Optional


class DriverRegister(BaseModel):
    name: str
    phone: str
    vehicle_number: str
    vehicle_type: str = "Advanced Life Support"


class DriverLocation(BaseModel):
    driver_id: str
    lat: float
    lng: float


class DriverStatus(BaseModel):
    driver_id: str
    status: str  # online | offline | busy


class SOSRequest(BaseModel):
    patient_name: str
    patient_phone: str
    lat: float
    lng: float
    address: str = "Unknown Location"
    notes: str = ""


class ComplaintCreate(BaseModel):
    name: str
    email: str = ""
    phone: str = ""
    message: str


class AdminLogin(BaseModel):
    username: str
    password: str


class CompleteSOSRequest(BaseModel):
    sos_id: str
