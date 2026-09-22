"""
NAWI TRUST — Instruments API Router

Handles instrument inventory querying and new instrument registration.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.instrument import Instrument
from app.schemas.instrument import InstrumentCreate, InstrumentResponse

router = APIRouter(prefix="/instruments", tags=["Instruments"])


@router.get("", response_model=List[InstrumentResponse])
def get_instruments(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """Retrieve all registered metrological instruments."""
    instruments = db.query(Instrument).offset(skip).limit(limit).all()
    return instruments


@router.post("", response_model=InstrumentResponse, status_code=status.HTTP_201_CREATED)
def create_instrument(
    payload: InstrumentCreate,
    db: Session = Depends(get_db),
):
    """Register a new weighing instrument under test."""
    # Check if an instrument with the same serial number already exists
    existing = db.query(Instrument).filter(Instrument.serial_number == payload.serial_number).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Instrument with serial number '{payload.serial_number}' already exists.",
        )

    instrument_data = payload.model_dump()
    new_instrument = Instrument(**instrument_data)
    db.add(new_instrument)
    db.commit()
    db.refresh(new_instrument)
    return new_instrument


@router.get("/by-serial/{serial_number}", response_model=InstrumentResponse)
def get_instrument_by_serial(
    serial_number: str,
    db: Session = Depends(get_db),
):
    """Retrieve a single instrument by its unique serial number."""
    instrument = db.query(Instrument).filter(Instrument.serial_number == serial_number).first()
    if not instrument:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Instrument with serial number '{serial_number}' not found.",
        )
    return instrument


@router.get("/{instrument_id}", response_model=InstrumentResponse)
def get_instrument_by_id(
    instrument_id: int,
    db: Session = Depends(get_db),
):
    """Retrieve a single instrument by its database ID."""
    instrument = db.query(Instrument).filter(Instrument.id == instrument_id).first()
    if not instrument:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Instrument with ID {instrument_id} not found.",
        )
    return instrument

