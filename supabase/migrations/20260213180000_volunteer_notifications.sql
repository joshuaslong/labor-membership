-- Email template for new volunteer opportunity notifications
INSERT INTO email_templates (template_key, name, subject, html_content, description, variables)
VALUES (
  'new_volunteer_opportunity',
  'New Volunteer Opportunity',
  'New Volunteer Opportunity: {opportunity_title}',
  '<p>Dear {name},</p>
<p>A new volunteer opportunity is available in your chapter!</p>
<p><strong style="font-size: 18px;">{opportunity_title}</strong></p>
<p><strong>Type:</strong> {opportunity_type}<br>
{opportunity_date}<strong>Location:</strong> {opportunity_location}<br>
{opportunity_skills}{opportunity_time_commitment}</p>
<p>{opportunity_description}</p>
<p><a href="{opportunity_url}" style="display: inline-block; background-color: #E25555; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">View Opportunity & Apply</a></p>
<p>Thank you for volunteering!</p>
<p>In solidarity,<br>Labor Party</p>',
  'Sent to chapter members who opted into volunteering when a new opportunity is published',
  '["name", "opportunity_title", "opportunity_type", "opportunity_date", "opportunity_location", "opportunity_skills", "opportunity_time_commitment", "opportunity_description", "opportunity_url"]'
)
ON CONFLICT (template_key) DO NOTHING;
