/** Route-level code splitting — keeps /app shell small on first paint. */
import { lazy } from 'react';

const lazyNamed = (loader, name) => lazy(() => loader().then((m) => ({ default: m[name] })));

export const DashboardHome = lazyNamed(() => import('./pages/DashboardHome.jsx'), 'DashboardHome');
export const BackendInventory = lazyNamed(() => import('./pages/BackendInventory.jsx'), 'BackendInventory');
export const BackendDetails = lazyNamed(() => import('./pages/BackendDetails.jsx'), 'BackendDetails');
export const QubitMonitoring = lazyNamed(() => import('./pages/QubitMonitoring.jsx'), 'QubitMonitoring');
export const LiveTelemetry = lazyNamed(() => import('./pages/LiveTelemetry.jsx'), 'LiveTelemetry');
export const CalibrationStatus = lazyNamed(() => import('./pages/CalibrationStatus.jsx'), 'CalibrationStatus');
export const DriftAnalysis = lazyNamed(() => import('./pages/DriftAnalysis.jsx'), 'DriftAnalysis');
export const HistoricalTrends = lazyNamed(() => import('./pages/HistoricalTrends.jsx'), 'HistoricalTrends');
export const TopologyExplorer = lazyNamed(() => import('./pages/TopologyExplorer.jsx'), 'TopologyExplorer');
export const CalibrationTimeline = lazyNamed(() => import('./pages/CalibrationTimeline.jsx'), 'CalibrationTimeline');
export const MetricsCoverage = lazyNamed(() => import('./pages/MetricsCoverage.jsx'), 'MetricsCoverage');
export const BackendComparison = lazyNamed(() => import('./pages/BackendComparison.jsx'), 'BackendComparison');
export const AnomalyMonitor = lazyNamed(() => import('./pages/AnomalyMonitor.jsx'), 'AnomalyMonitor');
export const TemporalReplay = lazyNamed(() => import('./pages/TemporalReplay.jsx'), 'TemporalReplay');
export const JobMonitoring = lazyNamed(() => import('./pages/JobMonitoring.jsx'), 'JobMonitoring');
export const QueueMonitoring = lazyNamed(() => import('./pages/QueueMonitoring.jsx'), 'QueueMonitoring');
export const ResourceHealth = lazyNamed(() => import('./pages/ResourceHealth.jsx'), 'ResourceHealth');
export const EnvironmentPage = lazyNamed(() => import('./pages/EnvironmentPage.jsx'), 'EnvironmentPage');
export const DeviceCapabilities = lazyNamed(() => import('./pages/DeviceCapabilities.jsx'), 'DeviceCapabilities');
export const AlertsEvents = lazyNamed(() => import('./pages/AlertsEvents.jsx'), 'AlertsEvents');
export const ReportsPage = lazyNamed(() => import('./pages/ReportsPage.jsx'), 'ReportsPage');
export const AdministrationPage = lazyNamed(() => import('./pages/AdministrationPage.jsx'), 'AdministrationPage');
export const OperationsCentre = lazyNamed(() => import('./pages/OperationsCentre.jsx'), 'OperationsCentre');
export const PlatformHealth = lazyNamed(() => import('./pages/PlatformHealth.jsx'), 'PlatformHealth');
export const OpsTimeline = lazyNamed(() => import('./pages/OpsTimeline.jsx'), 'OpsTimeline');
export const OnboardingFlow = lazyNamed(() => import('./pages/OnboardingFlow.jsx'), 'OnboardingFlow');
export const UserSettings = lazyNamed(() => import('./pages/UserSettings.jsx'), 'UserSettings');
export const IncidentDetailPage = lazyNamed(() => import('./pages/IncidentDetailPage.jsx'), 'IncidentDetailPage');
export const AlertDetailPage = lazyNamed(() => import('./pages/AlertDetailPage.jsx'), 'AlertDetailPage');
