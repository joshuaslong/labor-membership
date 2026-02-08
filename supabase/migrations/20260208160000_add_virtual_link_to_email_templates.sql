-- Add virtual_link_html variable to event email templates

UPDATE email_templates
SET html_content = '<p>Dear {name},</p>
<p>Your RSVP has been confirmed!</p>
<p><strong>Event:</strong> {event_name}<br>
<strong>Date:</strong> {event_date}<br>
<strong>Time:</strong> {event_time}<br>
<strong>Location:</strong> {event_location}</p>
{virtual_link_html}
<p>We look forward to seeing you there!</p>
<p>In solidarity,<br>Labor Party</p>',
variables = '["name", "event_name", "event_date", "event_time", "event_location", "rsvp_status", "virtual_link_html"]'
WHERE template_key = 'rsvp_confirmation';

UPDATE email_templates
SET html_content = '<p>Dear {name},</p>
<p>Just a reminder that <strong>{event_name}</strong> is happening tomorrow!</p>
<p><strong>Date:</strong> {event_date}<br>
<strong>Time:</strong> {event_time}<br>
<strong>Location:</strong> {event_location}</p>
{virtual_link_html}
<p>We look forward to seeing you there!</p>
<p>In solidarity,<br>Labor Party</p>',
variables = '["name", "event_name", "event_date", "event_time", "event_location", "virtual_link_html"]'
WHERE template_key = 'event_reminder_24h';

UPDATE email_templates
SET html_content = '<p>Dear {name},</p>
<p><strong>{event_name}</strong> is starting in about an hour!</p>
<p><strong>Time:</strong> {event_time}<br>
<strong>Location:</strong> {event_location}</p>
{virtual_link_html}
<p>See you soon!</p>
<p>In solidarity,<br>Labor Party</p>',
variables = '["name", "event_name", "event_date", "event_time", "event_location", "virtual_link_html"]'
WHERE template_key = 'event_reminder_1h';
