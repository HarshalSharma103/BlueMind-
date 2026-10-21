import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zgadnxfuguzyypmrxjai.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_FnARds3o9UuNGoD8xVn_mw_U3BvRYCQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const runPhase2Tests = async () => {
  console.log('====================================================');
  console.log('STARTING PHASE 2 COMPLETE PLATFORM TEST SUITE');
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
  const docUsername = `doc2_${randomSuffix}`;
  const patUsername = `pat2_${randomSuffix}`;
  const intruderUsername = `intruder_${randomSuffix}`;

  const docEmail = `doc2_${randomSuffix}@bluemindcares.test`;
  const patEmail = `pat2_${randomSuffix}@bluemindcares.test`;
  const intruderEmail = `intruder_${randomSuffix}@bluemindcares.test`;
  const testPassword = 'SecurePassword123!';

  let docClient = null;
  let patClient = null;
  let intruderClient = null;

  let docUser = null;
  let patUser = null;
  let relationshipId = null;
  let conversationId = null;
  let recordId = null;
  let assignmentId = null;

  try {
    // ----------------------------------------------------
    // SETUP: ACCOUNTS & ACTIVE RELATIONSHIP
    // ----------------------------------------------------
    console.log('--- 1. Setting Up Doctor, Patient & Active Relationship ---');

    // Register Doctor
    const { data: docSignUp } = await supabase.auth.signUp({
      email: docEmail,
      password: testPassword,
      options: {
        data: { username: docUsername, role: 'doctor', full_name: 'Dr. Phase 2 Specialist', specialty: 'Neurology' }
      }
    });
    docUser = docSignUp.user;

    // Register Patient
    const { data: patSignUp } = await supabase.auth.signUp({
      email: patEmail,
      password: testPassword,
      options: {
        data: { username: patUsername, role: 'patient', full_name: 'Patient Phase 2 Beta' }
      }
    });
    patUser = patSignUp.user;

    // Register Intruder (unauthorized user)
    const { data: intruderSignUp } = await supabase.auth.signUp({
      email: intruderEmail,
      password: testPassword,
      options: {
        data: { username: intruderUsername, role: 'patient', full_name: 'Intruder Malicious' }
      }
    });

    // Authenticate clients
    docClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await docClient.auth.signInWithPassword({ email: docEmail, password: testPassword });

    patClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await patClient.auth.signInWithPassword({ email: patEmail, password: testPassword });

    intruderClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await intruderClient.auth.signInWithPassword({ email: intruderEmail, password: testPassword });

    assert(docUser && patUser && intruderSignUp.user, 'Doctor, Patient, and Intruder test users registered');

    // Patient requests connection with doctor
    const { data: connReq, error: connReqErr } = await patClient
      .from('connection_requests')
      .insert({
        doctor_id: docUser.id,
        patient_id: patUser.id,
        message: 'Phase 2 comprehensive testing relationship'
      })
      .select()
      .single();

    assert(!connReqErr && connReq, 'Patient sends connection request');

    // Doctor accepts connection request
    const { error: acceptErr } = await docClient
      .from('connection_requests')
      .update({ status: 'ACCEPTED' })
      .eq('id', connReq.id);

    assert(!acceptErr, 'Doctor accepts connection request');

    // Verify Active Relationship was auto-created via trigger
    const { data: rel, error: relErr } = await docClient
      .from('doctor_patient_relationships')
      .select('*')
      .eq('doctor_id', docUser.id)
      .eq('patient_id', patUser.id)
      .eq('status', 'ACTIVE')
      .single();

    assert(!relErr && rel, 'Active doctor-patient relationship verified');
    relationshipId = rel?.id;

    // ----------------------------------------------------
    // TEST GROUP 2: MEDICAL RECORDS & STORAGE RLS
    // ----------------------------------------------------
    console.log('\n--- 2. Testing Medical Records & Storage RLS ---');

    const testFileContent = 'CONFIDENTIAL CLINICAL RECORD: Patient shows stable progression.';
    const testFileName = 'clinical_evaluation.txt';
    const filePath = `${patUser.id}/${crypto.randomUUID()}/${testFileName}`;

    // Doctor uploads record to private bucket
    const { error: uploadErr } = await docClient.storage
      .from('medical-records')
      .upload(filePath, new Blob([testFileContent], { type: 'text/plain' }), {
        contentType: 'text/plain'
      });

    assert(!uploadErr, 'Doctor uploads medical record to private storage bucket');

    // Doctor inserts medical record metadata
    const { data: recData, error: recInsertErr } = await docClient
      .from('medical_records')
      .insert({
        relationship_id: relationshipId,
        doctor_id: docUser.id,
        patient_id: patUser.id,
        title: 'Initial Clinical Assessment',
        description: 'Comprehensive neurological screening notes',
        file_path: filePath,
        file_name: testFileName,
        file_type: '.txt',
        file_size_bytes: testFileContent.length,
        mime_type: 'text/plain'
      })
      .select()
      .single();

    assert(!recInsertErr && recData, 'Doctor records medical record metadata with RLS');
    recordId = recData?.id;

    // Doctor generates signed URL
    const { data: docSigned, error: docSignedErr } = await docClient.storage
      .from('medical-records')
      .createSignedUrl(filePath, 120);

    assert(!docSignedErr && docSigned?.signedUrl, 'Doctor generates 120s signed download URL');

    // Patient views their own medical record metadata
    const { data: patRecs, error: patRecErr } = await patClient
      .from('medical_records')
      .select('*')
      .eq('patient_id', patUser.id);

    assert(!patRecErr && patRecs?.length === 1 && patRecs[0].title === 'Initial Clinical Assessment', 'Patient views authorized medical records');

    // Patient generates signed URL for their own record
    const { data: patSigned, error: patSignedErr } = await patClient.storage
      .from('medical-records')
      .createSignedUrl(filePath, 120);

    assert(!patSignedErr && patSigned?.signedUrl, 'Patient generates signed download URL for their own record');

    // SECURITY CHECK: Patient attempts to insert a medical record (must fail under RLS)
    const { error: patUnauthorizedInsertErr } = await patClient
      .from('medical_records')
      .insert({
        relationship_id: relationshipId,
        doctor_id: docUser.id,
        patient_id: patUser.id,
        title: 'Patient Forged Record',
        file_path: filePath,
        file_name: testFileName,
        file_type: '.txt',
        file_size_bytes: 100,
        mime_type: 'text/plain'
      });

    assert(!!patUnauthorizedInsertErr, 'SECURITY: Patient is rejected from inserting medical records (RLS enforced)');

    // SECURITY CHECK: Intruder attempts to view medical records
    const { data: intruderRecs } = await intruderClient
      .from('medical_records')
      .select('*')
      .eq('id', recordId);

    assert(intruderRecs?.length === 0, 'SECURITY: Unauthorized 3rd party cannot view patient medical records (RLS enforced)');

    // ----------------------------------------------------
    // TEST GROUP 3: GOOGLE FORMS QUESTIONNAIRE ASSIGNMENTS
    // ----------------------------------------------------
    console.log('\n--- 3. Testing Google Forms Questionnaire Assignments ---');

    const formUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSc-test-form-id/viewform';
    const formTitle = 'Sleep & Wellness Daily Log';

    // Doctor assigns external Google Form
    const { data: asgnData, error: asgnErr } = await docClient
      .from('questionnaire_assignments')
      .insert({
        relationship_id: relationshipId,
        doctor_id: docUser.id,
        patient_id: patUser.id,
        assignment_type: 'EXTERNAL_GOOGLE_FORM',
        external_title: formTitle,
        external_description: 'Daily tracking form on external Google Forms',
        external_form_url: formUrl,
        due_date: new Date(Date.now() + 86400000 * 3).toISOString(),
        status: 'PENDING'
      })
      .select()
      .single();

    assert(!asgnErr && asgnData && asgnData.assignment_type === 'EXTERNAL_GOOGLE_FORM', 'Doctor assigns external Google Form assessment');
    assignmentId = asgnData?.id;

    // Patient views pending Google Form assignment
    const { data: patAsgns, error: patAsgnsErr } = await patClient
      .from('questionnaire_assignments')
      .select('*')
      .eq('patient_id', patUser.id)
      .eq('status', 'PENDING');

    assert(!patAsgnsErr && patAsgns?.some(a => a.id === assignmentId && a.external_form_url === formUrl), 'Patient receives assigned external Google Form');

    // Patient marks Google Form completed
    const { error: markCompleteErr } = await patClient
      .from('questionnaire_assignments')
      .update({
        status: 'COMPLETED',
        completed_at: new Date().toISOString()
      })
      .eq('id', assignmentId)
      .eq('patient_id', patUser.id);

    assert(!markCompleteErr, 'Patient marks Google Form questionnaire as completed');

    // Doctor sees assignment completed
    const { data: docAsgnCheck } = await docClient
      .from('questionnaire_assignments')
      .select('status, completed_at')
      .eq('id', assignmentId)
      .single();

    assert(docAsgnCheck?.status === 'COMPLETED' && !!docAsgnCheck?.completed_at, 'Doctor verifies completed status of external Google Form');

    // ----------------------------------------------------
    // TEST GROUP 4: REALTIME CHAT & CONVERSATIONS
    // ----------------------------------------------------
    console.log('\n--- 4. Testing Realtime Chat & Messaging ---');

    // Doctor initiates conversation via RPC
    const { data: convIdDoc, error: convErrDoc } = await docClient.rpc('get_or_create_conversation', {
      p_relationship_id: relationshipId
    });

    assert(!convErrDoc && convIdDoc, 'Doctor creates conversation via get_or_create_conversation RPC');
    conversationId = convIdDoc;

    // Patient calls RPC -> returns the exact same conversation ID (idempotent)
    const { data: convIdPat, error: convErrPat } = await patClient.rpc('get_or_create_conversation', {
      p_relationship_id: relationshipId
    });

    assert(!convErrPat && convIdPat === conversationId, 'Patient retrieves existing conversation ID idempotently');

    // Doctor sends message
    const docMsgContent = 'Hello! Welcome to BlueMind Cares. How are you feeling today?';
    const { data: sentMsg, error: sendErr } = await docClient
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: docUser.id,
        content: docMsgContent
      })
      .select()
      .single();

    assert(!sendErr && sentMsg && sentMsg.content === docMsgContent, 'Doctor sends message into conversation');

    // Patient views message
    const { data: patMessages, error: patMsgErr } = await patClient
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId);

    assert(!patMsgErr && patMessages?.some(m => m.id === sentMsg?.id), 'Patient receives doctor message in chat');

    // Patient marks doctor's message as read
    const { error: markReadErr } = await patClient
      .from('messages')
      .update({ is_read: true })
      .eq('id', sentMsg.id);

    assert(!markReadErr, 'Patient marks message as read');

    // Patient sends reply
    const patReplyContent = 'Thank you Doctor, I have completed the sleep log questionnaire.';
    const { data: replyMsg, error: replyErr } = await patClient
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: patUser.id,
        content: patReplyContent
      })
      .select()
      .single();

    assert(!replyErr && replyMsg && replyMsg.content === patReplyContent, 'Patient sends reply message to doctor');

    // SECURITY CHECK: Intruder attempts to send message to conversation (must fail under RLS)
    const { error: intruderSendErr } = await intruderClient
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: intruderSignUp.user.id,
        content: 'I should not be able to send this message.'
      });

    assert(!!intruderSendErr, 'SECURITY: Unauthorized 3rd party cannot send messages to conversation (RLS enforced)');

    // SECURITY CHECK: Intruder attempts to read messages from conversation
    const { data: intruderMessages } = await intruderClient
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId);

    assert(intruderMessages?.length === 0, 'SECURITY: Unauthorized 3rd party cannot read messages (RLS enforced)');

    // ----------------------------------------------------
    // TEST SUMMARY
    // ----------------------------------------------------
    console.log('\n====================================================');
    console.log(`PHASE 2 TEST SUITE SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log('====================================================\n');

    if (passedTests === totalTests) {
      console.log('ALL PHASE 2 SYSTEMS AND SECURITY CONTROLS VERIFIED SUCCESSFULLY!\n');
    } else {
      console.error(`FAILED ${totalTests - passedTests} TESTS.\n`);
    }

  } catch (error) {
    console.error('Unexpected exception during Phase 2 testing:', error);
  }
};

runPhase2Tests();
