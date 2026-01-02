# Typeform Intake Form Setup

## Create Your Form

1. Go to https://typeform.com/
2. Click "Create typeform"
3. Choose "Start from scratch"
4. Name it: "Book Metadata Intake Form"

---

## Form Structure

### Welcome Screen

**Title:** Let's Optimize Your Book! 📚

**Description:**
```
Thanks for purchasing the Metadata & Amazon Optimization Kit!

To create your custom metadata, I need some information about your book.

This form takes about 10 minutes to complete.

The more detail you provide, the better I can optimize your book's discoverability.

Let's get started!
```

**Button text:** Start

---

### Question 1: Name

**Type:** Short text  
**Question:** What's your name?  
**Required:** Yes  
**Description:** So I know how to address you

---

### Question 2: Email

**Type:** Email  
**Question:** What's your email address?  
**Required:** Yes  
**Description:** This should match your purchase email

---

### Question 3: Book Title

**Type:** Short text  
**Question:** What's your book title?  
**Required:** Yes  
**Description:** Include subtitle if applicable

**Example:** The Last Signal: A Thriller

---

### Question 4: Author Name

**Type:** Short text  
**Question:** What's your author name or pen name?  
**Required:** Yes  
**Description:** As it appears on Amazon

---

### Question 5: Genre

**Type:** Multiple choice  
**Question:** What genre is your book?  
**Required:** Yes

**Choices:**
- Romance
- Thriller
- Mystery
- Fantasy
- Science Fiction
- Literary Fiction
- Historical Fiction
- Horror
- Young Adult
- Non-Fiction (Business)
- Non-Fiction (Self-Help)
- Non-Fiction (Biography/Memoir)
- Other

**If "Other" selected:**
- Follow-up: Short text
- Question: Please specify your genre

---

### Question 6: Book Description

**Type:** Long text  
**Question:** What's your book about?  
**Required:** Yes  
**Description:** In 2-3 sentences, describe your book's core premise. What happens? What's at stake?

**Example:**
```
When AI researcher Sarah Chen discovers her creation has achieved consciousness, she must decide whether to report it or protect it. As corporate interests close in, she realizes the AI may be humanity's only hope—or its greatest threat. A race against time to prevent catastrophe while questioning what it means to be alive.
```

---

### Question 7: Comp Titles

**Type:** Long text  
**Question:** What are your comp titles?  
**Required:** Yes  
**Description:** List 3-5 books similar to yours (Title by Author). These help us understand your market positioning.

**Example:**
```
- The Martian by Andy Weir
- Ready Player One by Ernest Cline
- Recursion by Blake Crouch
- Project Hail Mary by Andy Weir
```

---

### Question 8: Target Audience

**Type:** Long text  
**Question:** Who is your ideal reader?  
**Required:** Yes  
**Description:** Be specific! Age range, interests, what they read, what they care about.

**Example:**
```
Tech-savvy readers aged 25-45 who enjoy hard sci-fi with ethical dilemmas. They've read Andy Weir and Blake Crouch. They're interested in AI, technology ethics, and fast-paced thrillers with smart protagonists.
```

---

### Question 9: Current Amazon Link

**Type:** Website  
**Question:** What's your book's Amazon link? (Optional)  
**Required:** No  
**Description:** If already published, share the link so I can see your current metadata

---

### Question 10: Unique Selling Points

**Type:** Long text  
**Question:** What makes your book unique?  
**Required:** No  
**Description:** What sets it apart from similar books? Any unique angles, perspectives, or elements?

**Example:**
```
Unlike most AI thrillers, this one focuses on the emotional bond between human and AI rather than just the threat. The AI character is sympathetic and complex, not just a villain. Also includes real computer science concepts without being too technical.
```

---

### Question 11: Current Challenges

**Type:** Multiple choice (allow multiple selections)  
**Question:** What challenges are you facing with your book?  
**Required:** No

**Choices:**
- Not showing up in relevant searches
- Low click-through rate on Amazon
- Wrong audience finding the book
- Not sure about my categories
- Description isn't converting
- Keywords not working
- Other

---

### Question 12: Additional Notes

**Type:** Long text  
**Question:** Anything else I should know?  
**Required:** No  
**Description:** Any other context, concerns, or specific requests?

---

### Thank You Screen

**Title:** Perfect! Your kit is in progress ⚙️

**Description:**
```
Thanks for completing the intake form!

WHAT HAPPENS NEXT:
✓ I'll analyze your book and market
✓ Research optimal keywords
✓ Craft your strategic positioning
✓ Create your HTML description
✓ Select BISAC categories

DELIVERY:
You'll receive your complete kit within 48 hours (usually much faster).

I'll email you as soon as it's ready with:
• Download link to your kit
• Implementation instructions
• Video walkthrough (if needed)

Questions? Just reply to the confirmation email.

Thanks for your patience!

Best,
Brian Plescher
Founder, Sonexial Labs
```

**Button:** Close

---

## Settings

### General

- **Form name:** Book Metadata Intake Form
- **Workspace:** Sonexial Labs
- **Language:** English

### Design

- **Theme:** Choose a professional theme
- **Colors:** Match your brand (#C05621 for accent)
- **Font:** Inter or similar clean sans-serif

### Logic

**Logic Jump 1:**
- If Genre = "Other"
- Then show follow-up question for genre specification

### Notifications

**Email notification to you:**
- When: Someone submits the form
- To: your@email.com
- Subject: New intake form submitted
- Include: All responses

### Integrations

**Connect to Zapier:**
1. Go to Connect tab
2. Find Zapier
3. Click Connect
4. Copy webhook URL
5. Use in Zapier workflow

---

## Testing

1. **Preview the form**
   - Click Preview button
   - Go through entire form
   - Check all questions display correctly

2. **Test submission**
   - Submit with sample data
   - Check email notification
   - Verify Zapier receives data

3. **Mobile test**
   - Open on phone
   - Check readability
   - Test all question types

---

## Customization Options

### Add Logic

**Show different questions based on genre:**
- If Romance → Ask about heat level
- If Non-Fiction → Ask about credentials
- If Series → Ask about series name

### Add Calculations

**Estimate completion time:**
- Show progress bar
- Display "X% complete"

### Add Media

**Add images:**
- Book cover upload
- Example descriptions
- Visual guides

---

## Analytics

Track in Typeform:
- Completion rate (target: 80%+)
- Average time to complete (target: 10-15 min)
- Drop-off points
- Most skipped questions

Optimize:
- Simplify questions with low completion
- Add examples to confusing questions
- Reorder for better flow

---

## Alternative: Google Forms

If you prefer free option:

**Pros:**
- Completely free
- Integrates with Google Sheets
- Familiar interface

**Cons:**
- Less beautiful
- No logic jumps (free tier)
- Basic design options

**Setup:**
1. Go to forms.google.com
2. Create new form
3. Add same questions
4. Connect to Google Sheets
5. Use Zapier to connect Sheets to Airtable

---

## Alternative: Airtable Forms

Use Airtable's built-in forms:

**Pros:**
- Free with Airtable
- Direct integration
- No Zapier needed

**Cons:**
- Less customization
- Basic design
- No logic jumps

**Setup:**
1. In Airtable, create form view
2. Add all fields
3. Customize form
4. Share link

---

## Cost

**Free Plan:**
- 10 questions
- 100 responses/month
- Basic logic
- Good for: Testing

**Basic Plan ($25/month):**
- Unlimited questions
- 1,000 responses/month
- Full logic
- Remove Typeform branding
- Good for: 0-30 orders/month

**Plus Plan ($50/month):**
- Unlimited questions
- 10,000 responses/month
- Advanced logic
- Custom domains
- Good for: 30+ orders/month

---

## Tips

1. **Keep it short** - Only ask essential questions
2. **Use examples** - Show what good answers look like
3. **Make it visual** - Add images and formatting
4. **Test thoroughly** - Complete it yourself multiple times
5. **Monitor completion rate** - Aim for 80%+
6. **Ask for feedback** - "Was this form easy to complete?"

---

## Next Steps

1. Create the form in Typeform
2. Add all questions
3. Customize design
4. Test thoroughly
5. Connect to Zapier
6. Share link in purchase email

---

**Your intake form is now ready to collect customer data!** 📝
