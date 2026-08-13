const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { detecterStatut, expediteurIgnore } = require('../services/detection');

describe('expediteurIgnore', () => {
  describe('entrées invalides', () => {
    test('une adresse vide est ignorée', () => {
      assert.equal(expediteurIgnore(''), true);
    });

    test('null et undefined sont ignorés sans lever d’exception', () => {
      assert.equal(expediteurIgnore(null), true);
      assert.equal(expediteurIgnore(undefined), true);
    });

    test('une chaîne sans arobase est ignorée', () => {
      assert.equal(expediteurIgnore('pas-une-adresse'), true);
    });
  });

  describe('boîtes techniques', () => {
    test('les préfixes automatiques sont ignorés', () => {
      assert.equal(expediteurIgnore('noreply@entreprise.de'), true);
      assert.equal(expediteurIgnore('no-reply@entreprise.de'), true);
      assert.equal(expediteurIgnore('donotreply@entreprise.de'), true);
      assert.equal(expediteurIgnore('newsletter@entreprise.de'), true);
      assert.equal(expediteurIgnore('bounce@entreprise.de'), true);
    });

    test('le préfixe est reconnu même suivi d’autres caractères', () => {
      assert.equal(expediteurIgnore('noreply-jobs@entreprise.de'), true);
    });
  });

  describe('plateformes d’emploi', () => {
    test('les domaines listés sont ignorés', () => {
      assert.equal(expediteurIgnore('jobs@linkedin.com'), true);
      assert.equal(expediteurIgnore('alerts@stepstone.de'), true);
      assert.equal(expediteurIgnore('info@xing.com'), true);
    });

    test('les sous-domaines sont ignorés', () => {
      assert.equal(expediteurIgnore('notification@e.linkedin.com'), true);
      assert.equal(expediteurIgnore('alert@match.indeed.com'), true);
    });

    test('la casse n’a pas d’importance', () => {
      assert.equal(expediteurIgnore('NoReply@LinkedIn.COM'), true);
    });
  });

  describe('expéditeurs légitimes', () => {
    test('une adresse professionnelle ordinaire n’est pas ignorée', () => {
      assert.equal(expediteurIgnore('anna.mueller@siemens.de'), false);
      assert.equal(expediteurIgnore('recrutement@petite-agence.fr'), false);
      assert.equal(expediteurIgnore('hr@startup.io'), false);
    });

    test('un domaine seulement similaire n’est pas ignoré', () => {
      // `linkedin.com.phishing.ru` ne se termine pas par `.linkedin.com`
      assert.equal(expediteurIgnore('faux@linkedin.com.phishing.ru'), false);
    });
  });
});

describe('detecterStatut', () => {
  describe('absence de signal', () => {
    test('une entrée vide ne détecte rien', () => {
      assert.equal(detecterStatut(''), null);
      assert.equal(detecterStatut(null), null);
      assert.equal(detecterStatut(undefined), null);
    });

    test('une alerte de job board ne déclenche rien', () => {
      assert.equal(detecterStatut('Neue Angebote für Sie'), null);
    });

    test('un mot isolé ne suffit pas — c’est la tournure qui compte', () => {
      assert.equal(detecterStatut('Leider ist die Stelle in München'), null);
    });
  });

  describe('refus', () => {
    test('« we decided to » sans « not » n’est pas un refus (régression)', () => {
      // Le motif d’origine — /we (have )?(decided|regret) (not )?to/i — rendait
      // « not » optionnel : toute phrase contenant « we decided to » était classée
      // refus, y compris une invitation à un entretien. Scindé en deux motifs,
      // avec « not » obligatoire pour « decided ».
      assert.equal(detecterStatut('We decided to extend an offer.'), null);
      assert.equal(
        detecterStatut('We have decided not to proceed with your application.'),
        'refuse',
      );
      assert.equal(
        detecterStatut('We regret to inform you that we have chosen someone else.'),
        'refuse',
      );
    });
    test('refus en allemand', () => {
      assert.equal(
        detecterStatut('Leider müssen wir Ihnen mitteilen, dass wir uns anders entschieden haben.'),
        'refuse',
      );
      assert.equal(detecterStatut('Wir müssen Ihnen eine Absage erteilen.'), 'refuse');
    });

    test('refus en anglais', () => {
      assert.equal(
        detecterStatut('Unfortunately, we will not be moving forward with your application.'),
        'refuse',
      );
      assert.equal(detecterStatut('We have selected another candidate.'), 'refuse');
    });

    test('refus en français', () => {
      assert.equal(detecterStatut("Votre candidature n'a pas été retenue."), 'refuse');
      assert.equal(detecterStatut('Nous ne donnons pas suite à votre candidature.'), 'refuse');
    });
  });

  describe('acceptation', () => {
    test('offre en allemand', () => {
      assert.equal(detecterStatut('Anbei finden Sie Ihren Arbeitsvertrag.'), 'accepte');
      assert.equal(
        detecterStatut('Wir freuen uns, Ihnen die Position als Entwickler anbieten zu können.'),
        'accepte',
      );
    });

    test('offre en anglais', () => {
      assert.equal(detecterStatut('We would like to offer you the position.'), 'accepte');
    });

    test('offre en français', () => {
      assert.equal(
        detecterStatut('Nous avons le plaisir de vous proposer le poste.'),
        'accepte',
      );
    });
  });

  describe('entretien', () => {
    test('invitation en allemand', () => {
      assert.equal(detecterStatut('Einladung zum Vorstellungsgespräch'), 'entretien');
      assert.equal(detecterStatut('Wir möchten Sie zu einem Gespräch einladen.'), 'entretien');
    });

    test('invitation en anglais', () => {
      assert.equal(
        detecterStatut('We would like to invite you for an interview next week.'),
        'entretien',
      );
    });

    test('invitation en français', () => {
      assert.equal(detecterStatut('Nous souhaitons vous proposer un entretien.'), 'entretien');
    });
  });

  describe('priorité entre catégories', () => {
    test('un refus mentionnant un entretien reste un refus', () => {
      // Comportement voulu : les lettres de refus évoquent souvent l’entretien passé.
      assert.equal(
        detecterStatut(
          'Vielen Dank für das Vorstellungsgespräch. Leider müssen wir Ihnen absagen.',
        ),
        'refuse',
      );
    });

    test('une invitation à un entretien reste un entretien', () => {
      assert.equal(
        detecterStatut('Hello, we decided to invite you to an interview next week.'),
        'entretien',
      );
    });
  });
});