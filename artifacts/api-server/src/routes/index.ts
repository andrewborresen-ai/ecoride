import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storageRouter from "./storage";
import authRouter from "./auth";
import webhooksRouter from "./webhooks";
// Driver routes
import driverProfileRouter from "./driver/profile";
import driverDocumentsRouter from "./driver/documents";
import driverAgreementRouter from "./driver/agreement";
import driverShiftsRouter from "./driver/shifts";
import driverEarningsRouter from "./driver/earnings";
import driverNotificationsRouter from "./driver/notifications";
import driverVehicleAccessRouter from "./driver/vehicle-access";
import driverDashboardRouter from "./driver/dashboard";
// Admin routes
import adminDriversRouter from "./admin/drivers";
import adminAgreementsRouter from "./admin/agreements";
import adminShiftsRouter from "./admin/shifts";
import adminVehiclesRouter from "./admin/vehicles";
import adminEarningsRouter from "./admin/earnings";
import adminNotificationsRouter from "./admin/notifications";
import adminDashboardRouter from "./admin/dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(authRouter);
router.use(webhooksRouter);

// Driver routes
router.use(driverProfileRouter);
router.use(driverDocumentsRouter);
router.use(driverAgreementRouter);
router.use(driverShiftsRouter);
router.use(driverEarningsRouter);
router.use(driverNotificationsRouter);
router.use(driverVehicleAccessRouter);
router.use(driverDashboardRouter);

// Admin routes
router.use(adminDriversRouter);
router.use(adminAgreementsRouter);
router.use(adminShiftsRouter);
router.use(adminVehiclesRouter);
router.use(adminEarningsRouter);
router.use(adminNotificationsRouter);
router.use(adminDashboardRouter);

export default router;
