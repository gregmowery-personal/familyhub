# Database Schema Requirements for Multi-Generational Family Coordination

## Overview
This document outlines the database schema requirements to support FamilyHub.care's expanded vision as a multi-generational family coordination platform.

## Core Requirements

### 1. Role-Based Permissions System

#### User Roles and Age-Appropriate Access
- **Admin** (Primary Parent/Guardian): Full access to all family data and settings
- **Adult** (Secondary Parent/Adult Child): Can view and edit most content, restricted from sensitive financial/medical data
- **Teen** (13-17): Age-appropriate interface, can manage own tasks and view family calendar
- **Child** (8-12): Simplified interface, can check off own tasks and see basic family schedule
- **Senior** (Grandparent): Simplified interface option, can participate in coordination without overwhelming complexity

#### Permission Matrix
```sql
-- User role permissions
user_roles {
  id: uuid PRIMARY KEY
  name: string -- 'admin', 'adult', 'teen', 'child', 'senior'
  can_edit_family_settings: boolean
  can_view_documents: boolean
  can_edit_documents: boolean
  can_assign_tasks: boolean
  can_view_financial_info: boolean
  can_manage_users: boolean
  interface_complexity: string -- 'full', 'simplified', 'child'
}
```

### 2. Task Categories and Types

#### Multi-Generational Task Categories
- **Elder Care**: Medical appointments, medication reminders, social visits
- **Child Care**: School events, homework, activities, pickup/dropoff
- **General Family**: Household chores, errands, maintenance, meal planning
- **Emergency**: Urgent tasks requiring immediate family coordination

#### Task Schema
```sql
tasks {
  id: uuid PRIMARY KEY
  family_id: uuid REFERENCES families(id)
  category: string -- 'elder_care', 'child_care', 'general', 'emergency'
  priority: string -- 'low', 'medium', 'high', 'urgent'
  age_visibility: jsonb -- Which age groups can see this task
  assigned_to: uuid REFERENCES family_members(id)
  created_by: uuid REFERENCES family_members(id)
  title: string
  description: text
  due_date: timestamp
  is_recurring: boolean
  recurrence_pattern: jsonb
  completion_requires_photo: boolean -- For verification
  completion_requires_location: boolean -- For location-based tasks
  tags: string[] -- For filtering and organization
  created_at: timestamp
  updated_at: timestamp
}
```

### 3. Check-In System for Different User Types

#### Age-Appropriate Check-Ins
- **Child Check-ins**: "Did you finish your homework?", "Did you brush your teeth?"
- **Teen Check-ins**: "How was school today?", "Any upcoming tests or projects?"
- **Adult Check-ins**: "How are you feeling?", "Any concerns with the kids/parents?"
- **Senior Check-ins**: "How are you feeling today?", "Did you take your medications?"

#### Check-In Schema
```sql
check_ins {
  id: uuid PRIMARY KEY
  family_id: uuid REFERENCES families(id)
  target_member: uuid REFERENCES family_members(id)
  check_in_type: string -- 'daily', 'weekly', 'event_based'
  age_group: string -- 'child', 'teen', 'adult', 'senior'
  question_template: string
  response_type: string -- 'yes_no', 'scale', 'text', 'multiple_choice'
  is_required: boolean
  created_at: timestamp
}

check_in_responses {
  id: uuid PRIMARY KEY
  check_in_id: uuid REFERENCES check_ins(id)
  respondent_id: uuid REFERENCES family_members(id)
  response_data: jsonb
  mood_rating: integer -- 1-5 scale for emotional check-ins
  needs_followup: boolean
  created_at: timestamp
}
```

### 4. Family Groups and Relationships

#### Complex Family Structures
Support for:
- Single parent households
- Blended families with step-relationships
- Multi-generational households
- Extended family coordination
- Shared custody arrangements

#### Family Schema
```sql
families {
  id: uuid PRIMARY KEY
  name: string
  family_type: string -- 'nuclear', 'single_parent', 'blended', 'multigenerational'
  timezone: string
  created_at: timestamp
  updated_at: timestamp
}

family_members {
  id: uuid PRIMARY KEY
  family_id: uuid REFERENCES families(id)
  user_id: uuid REFERENCES auth.users(id)
  role: uuid REFERENCES user_roles(id)
  relationship: string -- 'parent', 'child', 'grandparent', 'stepparent', 'sibling'
  birth_date: date
  is_primary_contact: boolean
  emergency_contact: boolean
  custody_schedule: jsonb -- For shared custody situations
  access_level: string -- 'full', 'limited', 'view_only'
  interface_preference: string -- 'standard', 'simplified', 'child_friendly'
  created_at: timestamp
  updated_at: timestamp
}

family_relationships {
  id: uuid PRIMARY KEY
  family_id: uuid REFERENCES families(id)
  member_1: uuid REFERENCES family_members(id)
  member_2: uuid REFERENCES family_members(id)
  relationship_type: string -- 'parent_child', 'siblings', 'grandparent_grandchild'
  is_biological: boolean
  is_legal_guardian: boolean
  custody_percentage: integer -- For shared custody
}
```

### 5. Calendar and Events

#### Multi-Generational Event Types
```sql
events {
  id: uuid PRIMARY KEY
  family_id: uuid REFERENCES families(id)
  category: string -- 'school', 'medical', 'activity', 'family', 'work'
  event_type: string -- 'appointment', 'pickup', 'activity', 'reminder'
  title: string
  description: text
  start_time: timestamp
  end_time: timestamp
  location: string
  involves_members: uuid[] -- Array of family member IDs
  age_visibility: jsonb -- Which age groups should see this event
  requires_transportation: boolean
  transportation_assigned_to: uuid REFERENCES family_members(id)
  is_recurring: boolean
  recurrence_pattern: jsonb
  reminder_settings: jsonb
  created_by: uuid REFERENCES family_members(id)
  created_at: timestamp
  updated_at: timestamp
}
```

### 6. Communication and Notifications

#### Age-Appropriate Communication
```sql
notifications {
  id: uuid PRIMARY KEY
  family_id: uuid REFERENCES families(id)
  recipient_id: uuid REFERENCES family_members(id)
  sender_id: uuid REFERENCES family_members(id)
  notification_type: string -- 'task_assigned', 'event_reminder', 'check_in', 'emergency'
  message: text
  delivery_method: string[] -- ['app', 'email', 'sms'] based on age and preference
  is_urgent: boolean
  requires_acknowledgment: boolean
  acknowledged_at: timestamp
  read_at: timestamp
  created_at: timestamp
}

family_messages {
  id: uuid PRIMARY KEY
  family_id: uuid REFERENCES families(id)
  sender_id: uuid REFERENCES family_members(id)
  message_type: string -- 'general', 'announcement', 'question', 'emergency'
  content: text
  recipients: uuid[] -- Array of family member IDs
  age_appropriate: boolean -- Whether content is suitable for all ages
  created_at: timestamp
}
```

### 7. Documents and Information Management

#### Family Document Categories
```sql
documents {
  id: uuid PRIMARY KEY
  family_id: uuid REFERENCES families(id)
  category: string -- 'school', 'medical', 'legal', 'insurance', 'emergency'
  subcategory: string -- 'report_card', 'vaccination', 'passport', etc.
  title: string
  description: text
  file_path: string
  access_level: string -- 'all_adults', 'admin_only', 'age_appropriate'
  expiration_date: date
  is_sensitive: boolean
  uploaded_by: uuid REFERENCES family_members(id)
  created_at: timestamp
  updated_at: timestamp
}

emergency_contacts {
  id: uuid PRIMARY KEY
  family_id: uuid REFERENCES families(id)
  contact_type: string -- 'school', 'doctor', 'emergency', 'neighbor', 'family'
  name: string
  relationship: string
  phone_primary: string
  phone_secondary: string
  email: string
  address: text
  notes: text
  is_emergency_contact: boolean
  can_pickup_children: boolean
  available_hours: jsonb
  created_at: timestamp
  updated_at: timestamp
}
```

## Implementation Priorities

### Phase 1: Core Multi-Role System
1. User roles and permissions
2. Basic family member management
3. Age-appropriate task categories

### Phase 2: Enhanced Coordination
1. Check-in system for different age groups
2. Family event coordination
3. Basic notification system

### Phase 3: Advanced Features
1. Complex family relationship modeling
2. Document management with access controls
3. Advanced notification and communication features

## Security Considerations

### Data Protection by Age Group
- **Child Data**: Extra protection, limited sharing, parental controls
- **Teen Data**: Balance of privacy and family coordination
- **Adult Data**: Standard family sharing with privacy controls
- **Senior Data**: Easy access with security safeguards

### Access Control Implementation
- Row-level security (RLS) policies based on family membership and role
- Age-appropriate data filtering at the database level
- Audit logging for sensitive data access
- Secure document storage with role-based access

## Migration Strategy

### From Current Elder-Care Focus
1. Extend existing user roles to include new age-based roles
2. Add category fields to existing tasks and events
3. Create new check-in templates for different age groups
4. Implement age-visibility controls on existing data

### Backward Compatibility
- Existing families continue to work with elder-care focus
- Gradual opt-in to expanded features
- Preserve existing data and workflows