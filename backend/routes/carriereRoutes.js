const express = require('express');
const validate = require('../middlewares/validate');
const {
    listFormations,
    createFormation,
    updateFormation,
    deleteFormation,
} = require('../controllers/formationController');
const {
    listContacts,
    createContact,
    updateContact,
    deleteContact,
    listRelances,
    createRelance,
    toggleRelance,
    deleteRelance,
} = require('../controllers/contactController');
const {
    listInterviews,
    createInterview,
    updateInterview,
    deleteInterview,
    preparerInterview,
} = require('../controllers/interviewController');
const { getDashboard } = require('../controllers/dashboardController');
const {
    idParamsSchema,
    createFormationSchema,
    updateFormationSchema,
    createContactSchema,
    updateContactSchema,
    createRelanceSchema,
    toggleRelanceSchema,
    createInterviewSchema,
    updateInterviewSchema,
    preparerInterviewSchema,
} = require('../validators/carriereValidators');

const formations = express.Router();
formations.get('/', listFormations);
formations.post('/', validate(createFormationSchema), createFormation);
formations.put('/:id', validate(idParamsSchema, 'params'), validate(updateFormationSchema), updateFormation);
formations.delete('/:id', validate(idParamsSchema, 'params'), deleteFormation);

const contacts = express.Router();
contacts.get('/', listContacts);
contacts.post('/', validate(createContactSchema), createContact);
contacts.put('/:id', validate(idParamsSchema, 'params'), validate(updateContactSchema), updateContact);
contacts.delete('/:id', validate(idParamsSchema, 'params'), deleteContact);

const relances = express.Router();
relances.get('/', listRelances);
relances.post('/', validate(createRelanceSchema), createRelance);
relances.put('/:id', validate(idParamsSchema, 'params'), validate(toggleRelanceSchema), toggleRelance);
relances.delete('/:id', validate(idParamsSchema, 'params'), deleteRelance);

const interviews = express.Router();
interviews.get('/', listInterviews);
interviews.post('/', validate(createInterviewSchema), createInterview);
interviews.put('/:id', validate(idParamsSchema, 'params'), validate(updateInterviewSchema), updateInterview);
interviews.delete('/:id', validate(idParamsSchema, 'params'), deleteInterview);
interviews.post(
    '/:id/preparer',
    validate(idParamsSchema, 'params'),
    validate(preparerInterviewSchema),
    preparerInterview
);

const dashboard = express.Router();
dashboard.get('/', getDashboard);

module.exports = { formations, contacts, relances, interviews, dashboard };
