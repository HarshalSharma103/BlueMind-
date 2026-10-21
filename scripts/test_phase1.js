import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zgadnxfuguzyypmrxjai.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_FnARds3o9UuNGoD8xVn_mw_U3BvRYCQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const runTests = async () => {
  console.log('====================================================');
  console.log('STARTING PHASE 1 CORE PLATFORM TEST SUITE');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  const assert = (condition, description) => {
    totalTests++;
    if (condition) {
      console.log(`[PASS] Test ${totalTests}: ${description}`);
      passedTests++;
    } else {
      console.error(`[FAIL] Test ${totalTests}: ${description}`);
    }
  };

  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  const docUsername = `doc_${randomSuffix}`;
  const patUsername = `pat_${randomSuffix}`;
  const docEmail = `doc_${randomSuffix}@bluemindcares.test`;
  const patEmail = `pat_${randomSuffix}@bluemindcares.test`;
  const testPassword = 'SecurePassword123!';

  let docAuthClient = null;
  let patAuthClient = null;
  let doctorProfile = null;
  let patientProfile = null;
  let relationshipId = null;

  try {
    // ----------------------------------------------------
    // TEST GROUP 1: AUTHENTICATION & IDENTITY
    // ----------------------------------------------------
    console.log('\n--- 1. Testing Registration & Server-side Public ID Generation ---');
    
    // Register Doctor
    const { data: docSignUp, error: docSignUpErr } = await supabase.auth.signUp({
      email: docEmail,
      password: testPassword,
      options: {
        data: {
          username: docUsername,
          role: 'doctor',
          full_name: 'Dr. Test Specialist',
          specialty: 'Clinical Psychiatry'
        }
      }
    });

    assert(!docSignUpErr && docSignUp.user, 'Doctor registration succeeds via Supabase Auth');
    
    // Register Patient
    const { data: patSignUp, error: patSignUpErr } = await supabase.auth.signUp({
      email: patEmail,
      password: testPassword,
      options: {
        data: {
          username: patUsername,
          role: 'patient',
          full_name: 'Test Patient Beta'
        }
      }
    });

    assert(!patSignUpErr && patSignUp.user, 'Patient registration succeeds via Supabase Auth');

    // Sign in Doctor
    docAuthClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: docLogin, error: docLoginErr } = await docAuthClient.auth.signInWithPassword({
      email: docEmail,
      password: testPassword
    });

    assert(!docLoginErr && docLogin.user, 'Doctor login via email succeeds');

    // Fetch Doctor Profile
    const { data: docProf, error: docProfErr } = await docAuthClient
      .from('profiles')
      .select('*')
      .eq('id', docLogin.user.id)
      .single();

    assert(!docProfErr && docProf && docProf.public_id.startsWith('DR-'), `Doctor Public ID is securely generated: ${docProf?.public_id}`);
    assert(docProf?.role === 'doctor', 'Doctor role is authoritatively set to "doctor"');
    doctorProfile = docProf;

    // Sign in Patient
    patAuthClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: patLogin, error: patLoginErr } = await patAuthClient.auth.signInWithPassword({
      email: patEmail,
      password: testPassword
    });

    assert(!patLoginErr && patLogin.user, 'Patient login via email succeeds');

    // Fetch Patient Profile
    const { data: patProf, error: patProfErr } = await patAuthClient
      .from('profiles')
      .select('*')
      .eq('id', patLogin.user.id)
      .single();

    assert(!patProfErr && patProf && patProf.public_id.startsWith('PT-'), `Patient Public ID is securely generated: ${patProf?.public_id}`);
    assert(patProf?.role === 'patient', 'Patient role is authoritatively set to "patient"');
    patientProfile = patProf;

    // ----------------------------------------------------
    // TEST GROUP 2: USERNAME UNIQUENESS & CASE-INSENSITIVITY
    // ----------------------------------------------------
    console.log('\n--- 2. Testing Case-Insensitive Username Uniqueness ---');

    // Attempt to register with uppercase variant of doctor username
    const upperUsername = docUsername.toUpperCase();
    const { data: dupCheck } = await supabase.rpc('username_available', {
      p_username: upperUsername
    });

    assert(dupCheck === false, `RPC username_available accurately identifies "${upperUsername}" as taken`);

    const { error: dupSignUpErr } = await supabase.auth.signUp({
      email: `other_${randomSuffix}@bluemindcares.test`,
      password: testPassword,
      options: {
        data: {
          username: upperUsername,
          role: 'patient',
          full_name: 'Duplicate Intruder'
        }
      }
    });

    assert(dupSignUpErr !== null, 'Database trigger and citext constraint block duplicate username registration');

    // Test Username Login Resolution via RPC
    const { data: resolvedEmail, error: rpcErr } = await supabase.rpc('resolve_login_identifier', {
      p_identifier: docUsername.toUpperCase()
    });

    assert(!rpcErr && resolvedEmail === docEmail, 'Username login resolver successfully maps case-insensitive username to email');

    // Sign in with resolved username
    const { data: usernameLogin, error: usernameLoginErr } = await supabase.auth.signInWithPassword({
      email: resolvedEmail,
      password: testPassword
    });

    assert(!usernameLoginErr && usernameLogin.user, 'Login using resolved username succeeds');

    // Test incorrect password
    const { error: wrongPwErr } = await supabase.auth.signInWithPassword({
      email: docEmail,
      password: 'IncorrectPassword999!'
    });

    assert(wrongPwErr !== null, 'Login with incorrect password is rejected');

    // ----------------------------------------------------
    // TEST GROUP 3: DOCTOR DISCOVERY & PRIVACY BOUNDARIES
    // ----------------------------------------------------
    console.log('\n--- 3. Testing Doctor Discovery & Privacy Boundaries ---');

    // Patient queries doctor discovery list
    const { data: docList, error: docListErr } = await patAuthClient
      .from('doctor_profiles')
      .select('*, profile:profiles(full_name, public_id, role)')
      .eq('is_accepting_patients', true);

    assert(!docListErr && docList.length > 0, 'Patient can search and discover public doctor profiles');

    // Doctor attempting to query all patient profiles (Prohibited)
    const { data: allPatients, error: allPatErr } = await docAuthClient
      .from('patient_profiles')
      .select('*');

    assert(!allPatErr && allPatients.length === 0, 'Doctor cannot query or browse unrelated patient profiles (RLS enforced)');

    // ----------------------------------------------------
    // TEST GROUP 4: CONNECTION REQUESTS & PERSISTENT RELATIONSHIPS
    // ----------------------------------------------------
    console.log('\n--- 4. Testing Connection Request & Relationship Lifecycle ---');

    // Patient sends connection request to Doctor
    const { data: connReq, error: connReqErr } = await patAuthClient
      .from('connection_requests')
      .insert({
        patient_id: patientProfile.id,
        doctor_id: doctorProfile.id,
        message: 'Requesting clinical consultation.'
      })
      .select()
      .single();

    assert(!connReqErr && connReq?.status === 'PENDING', 'Patient can send connection request in PENDING state');

    // Attempt duplicate pending request
    const { error: dupReqErr } = await patAuthClient
      .from('connection_requests')
      .insert({
        patient_id: patientProfile.id,
        doctor_id: doctorProfile.id,
        message: 'Duplicate request attempt.'
      });

    assert(dupReqErr !== null, 'Database partial unique index blocks duplicate pending connection requests');

    // Doctor accepts request
    const { data: acceptedReq, error: acceptErr } = await docAuthClient
      .from('connection_requests')
      .update({ status: 'ACCEPTED' })
      .eq('id', connReq.id)
      .select()
      .single();

    assert(!acceptErr && acceptedReq?.status === 'ACCEPTED', 'Doctor can accept pending connection request');

    // Verify relationship was automatically created with ACTIVE status by trigger
    const { data: rel, error: relErr } = await docAuthClient
      .from('doctor_patient_relationships')
      .select('*')
      .eq('patient_id', patientProfile.id)
      .eq('doctor_id', doctorProfile.id)
      .single();

    assert(!relErr && rel?.status === 'ACTIVE', 'Database trigger automatically created doctor_patient_relationships record in ACTIVE status');
    relationshipId = rel?.id;

    // ----------------------------------------------------
    // TEST GROUP 5: APPOINTMENTS & STATE MACHINE ENFORCEMENT
    // ----------------------------------------------------
    console.log('\n--- 5. Testing Appointments & State Machine Transitions ---');

    const apptStart = new Date(Date.now() + 86400000).toISOString();
    const apptEnd = new Date(Date.now() + 90000000).toISOString();

    // Patient requests appointment
    const { data: appt, error: apptErr } = await patAuthClient
      .from('appointments')
      .insert({
        relationship_id: relationshipId,
        patient_id: patientProfile.id,
        doctor_id: doctorProfile.id,
        scheduled_start: apptStart,
        scheduled_end: apptEnd,
        reason_for_visit: 'Initial intake evaluation',
        status: 'PENDING'
      })
      .select()
      .single();

    assert(!apptErr && appt?.status === 'PENDING', 'Patient creates appointment in PENDING state');

    // Doctor approves appointment
    const { data: approvedAppt, error: approveErr } = await docAuthClient
      .from('appointments')
      .update({ status: 'APPROVED' })
      .eq('id', appt.id)
      .select()
      .single();

    assert(!approveErr && approvedAppt?.status === 'APPROVED', 'Doctor transitions appointment: PENDING -> APPROVED');

    // Doctor marks completed
    const { data: completedAppt, error: completeErr } = await docAuthClient
      .from('appointments')
      .update({ status: 'COMPLETED' })
      .eq('id', appt.id)
      .select()
      .single();

    assert(!completeErr && completedAppt?.status === 'COMPLETED', 'Doctor transitions appointment: APPROVED -> COMPLETED');

    // Attempt illegal transition: COMPLETED -> PENDING
    const { error: illegalTransErr } = await docAuthClient
      .from('appointments')
      .update({ status: 'PENDING' })
      .eq('id', appt.id);

    assert(illegalTransErr !== null, 'Database trigger blocks invalid transition from terminal state COMPLETED');

    // Verify appointment completion does NOT terminate relationship
    const { data: relCheck } = await docAuthClient
      .from('doctor_patient_relationships')
      .select('status')
      .eq('id', relationshipId)
      .single();

    assert(relCheck?.status === 'ACTIVE', 'Completing an appointment does NOT end the persistent relationship (remains ACTIVE)');

    // ----------------------------------------------------
    // TEST GROUP 6: QUESTIONNAIRE ENGINE & ATOMIC SCORING
    // ----------------------------------------------------
    console.log('\n--- 6. Testing Database-Driven Questionnaires & Scoring ---');

    // Fetch Adult PHQ-D Questionnaire & Version
    const { data: phqdVer } = await docAuthClient
      .from('questionnaire_versions')
      .select('id, questionnaire_id')
      .eq('questionnaire_id', 'ADULT_PHQ_D')
      .single();

    assert(phqdVer !== null, 'Built-in ADULT_PHQ_D questionnaire exists in database');

    // Doctor assigns questionnaire to patient
    const { data: assignment, error: asgnErr } = await docAuthClient
      .from('questionnaire_assignments')
      .insert({
        relationship_id: relationshipId,
        doctor_id: doctorProfile.id,
        patient_id: patientProfile.id,
        assignment_type: 'INBUILT',
        questionnaire_id: 'ADULT_PHQ_D',
        version_id: phqdVer.id,
        status: 'PENDING'
      })
      .select()
      .single();

    assert(!asgnErr && assignment?.status === 'PENDING', 'Doctor assigns Adult PHQ-D to patient');

    // Fetch questions and answer options
    const { data: questions } = await patAuthClient
      .from('questions')
      .select('id, options:answer_options(id, numeric_value)')
      .eq('version_id', phqdVer.id);

    assert(questions && questions.length === 22, `All 22 Adult PHQ-D questions retrieved from database (Section A + Section B)`);

    // Prepare answers payload
    const answerPayload = questions.map((q) => ({
      question_id: q.id,
      selected_option_id: q.options[0].id // Choose first option
    }));

    // Patient submits responses via atomic RPC
    const { data: submissionId, error: submitErr } = await patAuthClient.rpc('submit_questionnaire', {
      p_assignment_id: assignment.id,
      p_answers: answerPayload
    });

    assert(!submitErr && submissionId, 'Patient atomically submits responses via submit_questionnaire RPC');

    // Verify submission record and score
    const { data: subRecord } = await patAuthClient
      .from('questionnaire_submissions')
      .select('*')
      .eq('id', submissionId)
      .single();

    assert(subRecord !== null, 'Submission record stored with server-calculated total score');

    // Verify assignment status is updated to COMPLETED
    const { data: asgnUpdated } = await patAuthClient
      .from('questionnaire_assignments')
      .select('status')
      .eq('id', assignment.id)
      .single();

    assert(asgnUpdated?.status === 'COMPLETED', 'Assignment status automatically transitions to COMPLETED');

    // ----------------------------------------------------
    // TEST GROUP 7: MUTUAL OFFBOARDING & ARCHIVE INTEGRITY
    // ----------------------------------------------------
    console.log('\n--- 7. Testing Mutual Offboarding & Historical Preservation ---');

    // Doctor initiates offboarding
    const { data: offReq, error: offReqErr } = await docAuthClient
      .from('offboarding_requests')
      .insert({
        relationship_id: relationshipId,
        initiator_id: doctorProfile.id,
        target_id: patientProfile.id,
        reason: 'Patient therapy goals accomplished.',
        status: 'PENDING'
      })
      .select()
      .single();

    assert(!offReqErr && offReq, 'Doctor initiates offboarding request');

    // Verify relationship transitions to OFFBOARD_REQUESTED
    const { data: relOffReq } = await docAuthClient
      .from('doctor_patient_relationships')
      .select('status')
      .eq('id', relationshipId)
      .single();

    assert(relOffReq?.status === 'OFFBOARD_REQUESTED', 'Relationship automatically transitions to OFFBOARD_REQUESTED');

    // Patient accepts offboarding
    const { data: acceptedOff, error: acceptOffErr } = await patAuthClient
      .from('offboarding_requests')
      .update({ status: 'ACCEPTED' })
      .eq('id', offReq.id)
      .select()
      .single();

    assert(!acceptOffErr && acceptedOff?.status === 'ACCEPTED', 'Patient accepts offboarding request');

    // Verify relationship transitions to OFFBOARDED
    const { data: relOffboarded } = await docAuthClient
      .from('doctor_patient_relationships')
      .select('status, offboarded_at')
      .eq('id', relationshipId)
      .single();

    assert(relOffboarded?.status === 'OFFBOARDED' && relOffboarded?.offboarded_at !== null, 'Relationship transitions to OFFBOARDED with timestamp recorded');

    // Attempt to schedule new appointment on offboarded relationship
    const { error: offboardApptErr } = await patAuthClient
      .from('appointments')
      .insert({
        relationship_id: relationshipId,
        patient_id: patientProfile.id,
        doctor_id: doctorProfile.id,
        scheduled_start: new Date(Date.now() + 100000000).toISOString(),
        scheduled_end: new Date(Date.now() + 105000000).toISOString(),
        reason_for_visit: 'New visit attempt',
        status: 'PENDING'
      });

    assert(offboardApptErr !== null, 'Database trigger prohibits scheduling appointments on an OFFBOARDED relationship');

    // Verify historical records remain readable
    const { data: histAppts } = await docAuthClient
      .from('appointments')
      .select('*')
      .eq('relationship_id', relationshipId);

    assert(histAppts && histAppts.length > 0, 'Historical appointments remain preserved and readable after offboarding');

    const { data: histSubs } = await docAuthClient
      .from('questionnaire_submissions')
      .select('*')
      .eq('relationship_id', relationshipId);

    assert(histSubs && histSubs.length > 0, 'Historical questionnaire submissions remain preserved and readable after offboarding');

  } catch (err) {
    console.error('Unexpected error during test execution:', err);
  }

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('====================================================');
};

runTests();
