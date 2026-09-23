# Airtable Base Setup

## Create Your Base

1. Go to https://airtable.com/
2. Click "Add a base" → "Start from scratch"
3. Name it: "Sonexial Labs"

---

## Table 1: Leads

**Purpose:** Track free checklist downloads and potential customers

### Fields

| Field Name | Type | Options |
|------------|------|---------|
| Email | Email | Primary field |
| Date | Date | Include time |
| Source | Single select | Free Checklist, Contact Form, Exit Intent |
| Status | Single select | New, Contacted, Converted, Unsubscribed |
| Notes | Long text | - |
| Converted to Customer | Checkbox | - |
| Conversion Date | Date | - |

### Views

**View 1: All Leads**
- Show all records
- Sort by Date (newest first)

**View 2: New Leads**
- Filter: Status = New
- Sort by Date (newest first)

**View 3: Converted**
- Filter: Converted to Customer = Checked
- Sort by Conversion Date (newest first)

---

## Table 2: Orders

**Purpose:** Track paid product orders and fulfillment status

### Fields

| Field Name | Type | Options |
|------------|------|---------|
| Order ID | Single line text | Primary field |
| Customer Name | Single line text | - |
| Customer Email | Email | - |
| Purchase Date | Date | Include time |
| Amount | Currency | USD |
| Status | Single select | New, Form Sent, Form Completed, In Progress, Delivered, Follow-up Sent |
| Gumroad Link | URL | - |
| Form Link | URL | - |
| Delivery Date | Date | - |
| Google Drive Link | URL | - |
| Notes | Long text | - |
| Intake Response | Link to another record | Link to Intake Responses table |

### Single Select Options for Status

- 🆕 New
- 📧 Form Sent
- ✅ Form Completed
- ⚙️ In Progress
- 📦 Delivered
- 💬 Follow-up Sent

### Views

**View 1: All Orders**
- Show all records
- Sort by Purchase Date (newest first)
- Group by Status

**View 2: New Orders**
- Filter: Status = New
- Sort by Purchase Date (newest first)

**View 3: Awaiting Form**
- Filter: Status = Form Sent
- Sort by Purchase Date (oldest first)
- Color: Yellow (needs attention)

**View 4: Ready to Work** ⭐ (Your main work queue)
- Filter: Status = Form Completed
- Sort by Purchase Date (oldest first)
- Color: Green (ready for you)

**View 5: In Progress**
- Filter: Status = In Progress
- Sort by Purchase Date (oldest first)

**View 6: Delivered**
- Filter: Status = Delivered
- Sort by Delivery Date (newest first)

**View 7: This Week**
- Filter: Purchase Date is within the last 7 days
- Sort by Purchase Date (newest first)

---

## Table 3: Intake Responses

**Purpose:** Store customer book information from intake form

### Fields

| Field Name | Type | Options |
|------------|------|---------|
| Response ID | Autonumber | Primary field |
| Order | Link to another record | Link to Orders table |
| Book Title | Single line text | - |
| Author Name | Single line text | - |
| Genre | Single select | Romance, Thriller, Fantasy, Sci-Fi, Mystery, Literary Fiction, Non-Fiction, Other |
| Book Description | Long text | - |
| Comp Titles | Long text | - |
| Target Audience | Long text | - |
| Amazon Link | URL | - |
| Additional Notes | Long text | - |
| Submitted Date | Date | Include time |

### Views

**View 1: All Responses**
- Show all records
- Sort by Submitted Date (newest first)

**View 2: By Genre**
- Group by Genre
- Sort by Submitted Date (newest first)

---

## Table 4: Deliverables (Optional)

**Purpose:** Track what you've delivered to each customer

### Fields

| Field Name | Type | Options |
|------------|------|---------|
| Deliverable ID | Autonumber | Primary field |
| Order | Link to another record | Link to Orders table |
| Strategic Analysis | Attachment | - |
| HTML Description | Long text | - |
| Backend Keywords | Long text | - |
| BISAC Categories | Long text | - |
| Implementation Guide | Attachment | - |
| Google Drive Folder | URL | - |
| Created Date | Date | Include time |

---

## Automations (Airtable Native)

### Automation 1: New Order Alert

**Trigger:** When record enters view "Ready to Work"

**Actions:**
1. Send email to you
   - To: your@email.com
   - Subject: New order ready: {Book Title}
   - Body: Customer {Customer Name} has completed their intake form

### Automation 2: Overdue Form Reminder

**Trigger:** When record matches conditions
- Status = Form Sent
- Purchase Date is more than 2 days ago

**Actions:**
1. Update record
   - Add note: "Form overdue - consider manual follow-up"

---

## Dashboard View

Create an Interface (Airtable's dashboard feature):

### Page 1: Overview
- Total orders this month
- Orders by status (pie chart)
- Revenue this month
- Average time to delivery

### Page 2: Work Queue
- List of "Ready to Work" orders
- Quick actions: Mark as In Progress, Mark as Delivered

### Page 3: Customer Details
- Customer information
- Order history
- Intake responses
- Deliverables

---

## Sample Data (For Testing)

### Sample Lead
- Email: test@example.com
- Date: Today
- Source: Free Checklist
- Status: New

### Sample Order
- Order ID: gum_test123
- Customer Name: John Doe
- Customer Email: john@example.com
- Purchase Date: Today
- Amount: $29
- Status: Form Completed

### Sample Intake Response
- Book Title: The Last Signal
- Author Name: John Doe
- Genre: Thriller
- Book Description: A tech thriller about AI gone wrong
- Comp Titles: The Martian, Ready Player One
- Target Audience: Tech-savvy readers 25-45

---

## Mobile App

Download Airtable mobile app to:
- Check new orders on the go
- Update status from anywhere
- View customer details
- Add notes

---

## Sharing & Permissions

### If you have a team:

**Admin (You):**
- Full access to all tables
- Can edit automations
- Can manage billing

**Kit Creator:**
- Can view Orders and Intake Responses
- Can update Status and add Deliverables
- Cannot delete records

**Customer Service:**
- Can view Orders
- Can add Notes
- Cannot edit Status or Deliverables

---

## Backup

Airtable automatically backs up your data, but you can also:

1. **Export to CSV** (weekly)
   - Each table → ... menu → Download CSV

2. **Sync to Google Sheets** (real-time)
   - Use Zapier or Airtable Sync

3. **API Backup** (automated)
   - Use Airtable API to backup to your server

---

## Tips

1. **Use colors** - Color-code statuses for quick visual scanning
2. **Add emojis** - Use emojis in status names for better UX
3. **Create templates** - Save common notes as templates
4. **Use filters** - Create custom views for different workflows
5. **Mobile notifications** - Enable push notifications for new orders

---

## Cost

**Free Plan:**
- 1,200 records per base
- Unlimited bases
- 2GB attachments per base
- Good for: 0-100 orders/month

**Plus Plan ($10/user/month):**
- 5,000 records per base
- 5GB attachments per base
- 6-month revision history
- Good for: 100-500 orders/month

**Pro Plan ($20/user/month):**
- 50,000 records per base
- 20GB attachments per base
- 1-year revision history
- Good for: 500+ orders/month

---

## Next Steps

1. Create the base
2. Set up all 4 tables
3. Add sample data
4. Create views
5. Test with Zapier
6. Refine based on usage

---

**Your Airtable base is now your command center!** 📊
