from app.core.database import Base, SessionLocal, engine
import app.models.entities  # noqa: F401
from app.models.entities import BackendModel, ProviderModel, QubitModel
from app.services.anomaly_scan import scan_fleet_anomalies


def test_scan_scoped_to_one_backend():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        db.add(ProviderModel(provider_id="ibm", provider_name="IBM", provider_type="ibm"))
        for bid in ("b_one", "b_two"):
            db.add(
                BackendModel(
                    backend_id=bid,
                    provider_id="ibm",
                    backend_name=bid,
                    backend_type="simulator",
                    qubit_count=2,
                    operational_status="ONLINE",
                )
            )
            db.add(QubitModel(qubit_id=f"{bid}_Q0", backend_id=bid, qubit_index=0))
        db.commit()

        scoped = scan_fleet_anomalies(db, metric="t1", backend_id="b_one")
        assert scoped["backends_scanned"] == 1
        assert scoped["series_scanned"] == 1
    finally:
        db.close()