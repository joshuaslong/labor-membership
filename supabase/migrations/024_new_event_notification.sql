-- Migration: New Event Notification Email Template
-- Adds email template for notifying members when a new event is created in their chapter

INSERT INTO email_templates (template_key, name, subject, html_content, description, variables) VALUES
(
  'new_event',
  'New Event Announcement',
  'New Event: {event_name}',
  '<p>Dear {name},</p>
<p>A new event has been scheduled for your chapter!</p>
<p><strong style="font-size: 18px;">{event_name}</strong></p>
<p><strong>Date:</strong> {event_date}<br>
<strong>Time:</strong> {event_time}<br>
<strong>Location:</strong> {event_location}</p>
<p>{event_description}</p>
<p><a href="{event_url}" style="display: inline-block; background-color: #E25555; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">View Event & RSVP</a></p>
<p>We hope to see you there!</p>
<p>In solidarity,<br>Labor Party</p>',
  'Sent to chapter members when a new event is published',
  '["name", "event_name", "event_date", "event_time", "event_location", "event_description", "event_url"]'
)
ON CONFLICT (template_key) DO NOTHING;
