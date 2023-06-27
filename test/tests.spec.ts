import { expect } from 'chai';
import request from 'supertest';
import app from '../index';
import { describe, it } from 'mocha';

describe('clinicaltrials endpoint', () => {
  it('should return a list of eligible trials for a given patient', async () => {
    const patientId = '123';
    const body = {
      age: 64,
      gender: 'male',
      conditions: 'aspirin',
      targetTreatment: 'lung cancer',
      location: 'Birmingham'
    };
    const response = await request(app)
      .post(`/clinicaltrials/${patientId}`)
      .send(body)
      .expect(200);
    expect(response.body).to.be.an('array');
    expect(response.body).to.have.lengthOf.at.most(5);
    response.body.forEach((trial: any) => {
      expect(trial).to.have.property('id');
      expect(trial).to.have.property('description');
    });
  });
});

it('should return an error for missing required fields', async () => {
  const patientId = '123';
  const body = {
    age: 30,
    gender: 'male',
    conditions: 'aspirin',
    //Omit required field targetTreatment',
    location: 'New York'
  };
  const response = await request(app)
    .post(`/clinicaltrials/${patientId}`)
    .send(body)
    .expect(400);
  expect(response.body).to.have.property('message');
  expect(response.body.message).to.equal('Missing required fields');
});