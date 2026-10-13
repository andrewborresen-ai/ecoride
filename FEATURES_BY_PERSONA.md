# EcoRide features by persona

This guide describes the user-facing features currently implemented in the EcoRide driver app and admin web panel. EcoRide supports electric vehicles and Khula Rides LPG vehicles. It is a fleet and shift operations platform, not an on-demand ride-hailing app.

## Personas

- **Driver:** Applies to join a fleet, then manages shifts, vehicle access, earnings, notifications, and their profile in the driver app.
- **Fleet administrator:** Reviews drivers and documents, manages vehicles, agreements, shifts, allocations, earnings, and driver communications in the admin panel.

There is no separate dispatcher, passenger, or finance persona in the current application. The `mockup-sandbox` is a UI preview artifact, not another user-facing product.

## Driver

### 1. Create an account and apply

1. Open the driver app and choose **Sign Up**. Register with an email address and password; use **Forgot Password** if needed later.
2. Complete the onboarding sections:
   - **Personal:** Enter your name and contact information, plus identity details requested by the form.
   - **Address:** Enter your home address; use address suggestions when available.
   - **Banking:** Provide bank and account details for earnings records.
   - **Fleet:** Choose EcoRide Electric or Khula Rides LPG. The form may also collect a Bolt driver ID and declaration.
   - **Documents:** Upload the required profile photo, South African ID, driver's licence, and PDP certificate. Proof of address and bank statement are optional. Choose a photo from the library or use the camera where available.
   - **Agreement:** Read the active fleet agreement, scroll through it, enter your legal name, draw your signature, and accept.
3. Review the application and select **Submit Application** once the required sections are complete.
4. The application status screen shows whether the application is under review, rejected, or suspended. If rejected, review the reason, correct the application/documents, and reapply when the option is available. Contact support from this screen if needed.

An administrator must approve an application before the driver can use the main tabs. Document status and reviewer notes are shown in the app; rejected documents can be uploaded again.

### 2. Use the approved-driver tabs

After approval, the bottom navigation opens **Home**, **Shifts**, **Earnings**, **Alerts**, and **Profile**.

- **Home:** Review the dashboard summary, including your upcoming shift, current vehicle assignment when one exists, weekly earnings/shifts, and unread-alert count. Pull down to refresh. Use the shift card to open its details.
- **Shifts:** In **Open**, choose **This Week**, **Next Week**, or **All**, then select **Request Shift** on a suitable shift. Check **Requested** for pending requests, **Confirmed** for accepted shifts, and **Past** for completed, declined, or cancelled shifts. Open a shift card for its details. You can cancel a pending request from that card; confirmed shifts cannot be cancelled in the app.
- **Vehicle access:** When an assigned shift is active and the vehicle/assignment is connected to telematics, open the confirmed shift details and select **Unlock Vehicle**. The app asks for confirmation and displays the result. Unlocking is limited to the assignment's shift window; if the vehicle or driver is not synced, contact support. Vehicle unlock depends on the external telematics service being configured and available.
- **Earnings:** Select **This Week**, **This Month**, **All Time**, or **Custom** and enter the requested date range for custom results. Open an earning row to see its gross amount, deductions, incentives, penalties, net amount, trip count (if supplied), and notes. Only earnings published by an administrator are visible.
- **Alerts:** Open **Alerts** to read in-app notifications. Unread messages are marked with a tab badge; opening an unread item marks it read.
- **Profile:** Review your contact, address, banking, fleet, telematics, and document information. The current profile edit action changes your phone number; it does not edit all onboarding fields. Re-upload rejected documents here. Use **Sign Out** to end the session.

### Driver feature boundaries

- A shift request is not a confirmed shift; wait for the administrator's decision.
- Vehicle unlocking is a request to the configured telematics provider, not a guarantee that the vehicle will unlock. EcoRide does not perform biometric recognition itself.
- In-app earnings are records, not a payment or bank transfer. No payment processor is included.
- Shift detail and earnings detail screens display data from the app's API; they are not separate trip-tracking or route-history tools.

## Fleet administrator

### Sign in and navigation

1. Open the EcoRide admin web panel and sign in with the authorized Clerk account.
2. Use the sidebar (or the menu on a narrow screen) to open **Dashboard**, **Drivers**, **Vehicles**, **Agreements**, **Shifts**, **Fleet Access**, **Earnings**, **Notifications**, or **Settings**.

Admin access is role-protected. The web panel permits `admin` and `superadmin` at its UI guard, while API admin operations require the `admin` role. An account lacking API admin access will be denied when it attempts those operations.

### Review fleet activity on the Dashboard

Use the dashboard KPI cards to review driver and vehicle totals, pending applications, open shifts, shifts needing allocation, and earnings awaiting publication. Open the recent-application and open-shift entries to jump into the relevant record or workflow.

### Manage driver applications and records

1. Open **Drivers**. Search by driver name or phone and narrow the list using status, fleet, agreement, telematics, document, or user-status filters.
2. Select a driver to open their detail page. Review their contact and fleet details, agreement status, bank details, telematics status, documents, vehicle assignments, and earnings.
3. In **Documents**, open a submitted file and mark it verified or rejected; add review notes as appropriate.
4. Approve a ready application, or reject/suspend it with a reason. The reason is shared with the driver.
5. If telematics registration failed, use the retry action. Internal driver notes can also be saved on the detail page.

Approval starts a background telematics-registration attempt when the integration is configured; it does not wait for that external call to complete.

### Manage vehicles

1. Open **Vehicles** and add a vehicle using its registration number and fleet type; provide any available make, model, year, colour, VIN, telematics identifier, telematics setting, and internal notes.
2. Use the edit action to update vehicle details or its status, such as available, assigned, maintenance, or retired.
3. To assign a vehicle for a shift, open that shift's detail page and choose an available vehicle for a confirmed allocation.

Telematics-dependent access requires the vehicle and assignment to be synchronized with the external provider.

### Publish agreements for driver onboarding

1. Open **Agreements** and create a version with a title, version number, fleet type, and agreement text. A PDF can also be uploaded.
2. Edit drafts as needed, then activate the agreement. Drivers in that fleet will be shown the active agreement to review and sign during onboarding.

An active agreement is not editable through the normal edit flow; create and activate a new version to replace it.

### Create shifts and process requests

1. Open **Shifts** and create a shift with a title, fleet type, start/end time, and capacity. A description is optional.
2. Edit an open or full shift as needed. Close a shift to stop new requests while retaining confirmed allocations, or cancel it to cancel allocations and notify drivers.
3. Open a shift to review **Requested**, **Confirmed**, and **Waitlist** allocations.
4. Confirm a request, decline it with a reason, move an allocation to or from the waitlist, and assign an available vehicle to confirmed drivers.

Drivers see open shifts matching their selected date range and can request them from the app.

### Prepare and publish earnings

1. Open **Earnings** to create an earning record for a driver and period, or import a payroll spreadsheet using the import workflow. Review the import matches before committing the records.
2. Filter records by status; edit draft records and review the calculated gross, deductions, incentives, penalties, net amount, trip count, notes, and any shift details.
3. Select **Publish** when the record is ready to be shown to the driver. Published records can be recalled to draft by an administrator. Use the export action to download earnings as CSV.

Amounts are recorded in cents and displayed as ZAR. Publishing makes the earnings visible in the driver app; it does not transfer money.

### Send driver notifications

1. Open **Notifications** and start a message.
2. Choose a recipient group or individual driver, enter a title and message, and select a notification type.
3. Send immediately or provide a future delivery time if scheduling is offered in the form. Use the page's sent-history view to review messages.

These are in-app notifications. The codebase does not provide mobile push, SMS, or email delivery.

### Review vehicle-access events

Open **Fleet Access** to inspect the read-only log of vehicle unlock/access activity. Filter by vehicle, driver, event type, and date range. Use the event status and telematics request information to help investigate access attempts.

### Account settings

Open **Settings** to view the signed-in account information and role, or sign out. This page does not currently expose fleet configuration controls.

## Platform and integration notes

- Driver and administrator sign-in use Clerk. Protected features require a corresponding EcoRide user record and role.
- Driver documents and agreement PDFs use object storage. Upload availability depends on the application's storage configuration.
- Vehicle registration, assignment synchronization, unlock, and ignition validation rely on the optional CanFleet SA telematics integration. When it is not configured or unavailable, telematics-dependent operations can fail; administrators can inspect sync status and retry driver registration.
- The platform records onboarding, shift allocation, vehicle access, notifications, and earnings workflows. It does not implement trip dispatch, trip/route tracking, ratings, referral rewards, biometric AI, or payment processing.
