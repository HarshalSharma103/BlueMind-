export type AppRole = 'doctor' | 'patient';

export interface UserProfile {
  id: string;
  username: string;
  public_id: string;
  role: AppRole;
  full_name: string;
  avatar_url?: string | null;
  created_at: string;
}

export interface DoctorProfile {
  id: string;
  license_number?: string | null;
  specialty: string;
  bio?: string | null;
  consultation_fee: number;
  years_of_experience: number;
  is_accepting_patients: boolean;
  created_at: string;
  updated_at: string;
  profile?: UserProfile;
}

export interface PatientProfile {
  id: string;
  date_of_birth?: string | null;
  gender?: string | null;
  blood_group?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  medical_allergies?: string | null;
  created_at: string;
  updated_at: string;
  profile?: UserProfile;
}

export type ConnectionRequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';

export interface ConnectionRequest {
  id: string;
  patient_id: string;
  doctor_id: string;
  status: ConnectionRequestStatus;
  message?: string | null;
  responded_at?: string | null;
  created_at: string;
  updated_at: string;
  doctor?: UserProfile;
  patient?: UserProfile;
}

export type RelationshipStatus = 'ACTIVE' | 'OFFBOARD_REQUESTED' | 'OFFBOARDED';

export interface DoctorPatientRelationship {
  id: string;
  patient_id: string;
  doctor_id: string;
  connection_request_id?: string | null;
  status: RelationshipStatus;
  established_at: string;
  offboarded_at?: string | null;
  created_at: string;
  updated_at: string;
  doctor?: UserProfile;
  patient?: UserProfile;
}

export type OffboardingStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface OffboardingRequest {
  id: string;
  relationship_id: string;
  initiator_id: string;
  target_id: string;
  reason?: string | null;
  status: OffboardingStatus;
  requested_at: string;
  responded_at?: string | null;
  created_at: string;
  initiator?: UserProfile;
  target?: UserProfile;
}

export type AppointmentStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';

export interface Appointment {
  id: string;
  relationship_id: string;
  patient_id: string;
  doctor_id: string;
  scheduled_start: string;
  scheduled_end: string;
  status: AppointmentStatus;
  reason_for_visit?: string | null;
  doctor_notes?: string | null;
  created_at: string;
  updated_at: string;
  doctor?: UserProfile;
  patient?: UserProfile;
}

export interface Questionnaire {
  id: string;
  title: string;
  description: string;
  target_demographic?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface QuestionnaireVersion {
  id: string;
  questionnaire_id: string;
  version_number: number;
  scoring_method: 'SUMMATION' | 'SECTION_SUMMATION' | 'CUSTOM';
  instructions?: string | null;
  is_published: boolean;
  published_at?: string | null;
  created_at: string;
}

export interface Question {
  id: string;
  version_id: string;
  section_name?: string | null;
  question_text: string;
  display_order: number;
  answer_type: 'SINGLE_CHOICE' | 'BOOLEAN' | 'TEXT';
  is_active: boolean;
  created_at: string;
  options?: AnswerOption[];
}

export interface AnswerOption {
  id: string;
  version_id: string;
  question_id: string;
  display_text: string;
  numeric_value: number;
  display_order: number;
}

export type AssignmentType = 'INBUILT' | 'EXTERNAL_GOOGLE_FORM';
export type AssignmentStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

export interface QuestionnaireAssignment {
  id: string;
  relationship_id: string;
  doctor_id: string;
  patient_id: string;
  assignment_type: AssignmentType;
  questionnaire_id?: string | null;
  version_id?: string | null;
  external_title?: string | null;
  external_description?: string | null;
  external_form_url?: string | null;
  due_date?: string | null;
  status: AssignmentStatus;
  assigned_at: string;
  completed_at?: string | null;
  created_at: string;
  questionnaire?: Questionnaire;
  doctor?: UserProfile;
  patient?: UserProfile;
}

export interface QuestionnaireSubmission {
  id: string;
  assignment_id: string;
  relationship_id: string;
  patient_id: string;
  version_id: string;
  total_score: number;
  submitted_at: string;
  answers?: QuestionnaireAnswer[];
}

export interface QuestionnaireAnswer {
  id: string;
  submission_id: string;
  version_id: string;
  question_id: string;
  selected_option_id: string;
  numeric_value: number;
  answered_at: string;
  question?: Question;
  selected_option?: AnswerOption;
}

// Medical Records
export interface MedicalRecord {
  id: string;
  relationship_id: string;
  doctor_id: string;
  patient_id: string;
  title: string;
  description?: string | null;
  file_path: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number;
  mime_type: string;
  uploaded_at: string;
  created_at: string;
  doctor?: UserProfile;
  patient?: UserProfile;
}

// Chat / Realtime Messaging
export interface Conversation {
  id: string;
  relationship_id: string;
  created_at: string;
  updated_at: string;
  relationship?: DoctorPatientRelationship;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  profile_id: string;
  joined_at: string;
  profile?: UserProfile;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  sent_at: string;
  created_at: string;
  sender?: UserProfile;
}
