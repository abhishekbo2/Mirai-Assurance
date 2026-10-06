const adminController = require('../../controllers/adminController');
const User = require('../../models/User');
const Application = require('../../models/Application');
const Claim = require('../../models/Claim');
const nodemailer = require('nodemailer');
const Policy = require('../../models/Policy');
const Renewal = require('../../models/Renewal');
const RenewalApprovalRequest = require('../../models/RenewalApprovalRequest');
const Payment = require('../../models/Payment');

describe('Admin Controller Unit Tests', () => {
    let req, res;

    beforeEach(() => {
        res = {
            status: jasmine.createSpy('status').and.callFake(function() { return this; }),
            json: jasmine.createSpy('json')
        };
    });

    it('should fetch only users with the role customer', async () => {
        spyOn(User, 'find').and.returnValue(Promise.resolve([{ name: 'Customer A' }]));
        
        await adminController.getAllCustomers({}, res);

        expect(User.find).toHaveBeenCalledWith({ role: 'customer' });
        expect(res.json).toHaveBeenCalled();
    });

    it('should notify a user and update status to default', async () => {
        req = { body: { applicationId: 'app_1' } };
        const mockApp = { 
            user: { email: 'm@test.com', name: 'M' }, 
            plan: { title: 'Basic' },
            save: jasmine.createSpy('save').and.returnValue(Promise.resolve())
        };

        spyOn(Application, 'findById').and.returnValue({
            populate: jasmine.createSpy('populate').and.returnValue(Promise.resolve(mockApp))
        });
        const previousEmailConfig = {
            SMTP_HOST: process.env.SMTP_HOST,
            SMTP_PORT: process.env.SMTP_PORT,
            EMAIL_USER: process.env.EMAIL_USER,
            EMAIL_PASS: process.env.EMAIL_PASS,
            EMAIL_FROM: process.env.EMAIL_FROM,
        };
        Object.assign(process.env, {
            SMTP_HOST: 'smtp.test',
            SMTP_PORT: '2525',
            EMAIL_USER: 'test-user',
            EMAIL_PASS: 'test-password',
            EMAIL_FROM: 'test@example.com',
        });
        spyOn(nodemailer, 'createTransport').and.returnValue({
            sendMail: jasmine.createSpy('sendMail').and.resolveTo(),
        });

        await adminController.notifyDefault(req, res);

        Object.assign(process.env, previousEmailConfig);

        expect(mockApp.status).toBe('default');
        expect(res.json).toHaveBeenCalledWith({ msg: "Email sent!" });
    });

    it('returns customer policies, renewal history, approval requests, and renewal payment status', async () => {
        const customer = { _id: 'user_1', name: 'Customer A', email: 'a@test.com', role: 'customer' };
        const policy = { _id: 'policy_1', policyNumber: 'POLICY-1' };
        const renewal = { _id: 'renewal_1', policy: 'policy_1', sequence: 1, toObject: () => ({ _id: 'renewal_1', policy: 'policy_1', sequence: 1 }) };
        spyOn(User, 'findOne').and.returnValue({ select: jasmine.createSpy('select').and.returnValue(Promise.resolve(customer)) });
        spyOn(Application, 'find').and.returnValue({
            select: jasmine.createSpy('select').and.returnValue({
                populate: jasmine.createSpy('populate').and.returnValue(Promise.resolve([])),
            }),
        });
        spyOn(Claim, 'find').and.returnValue({ select: jasmine.createSpy('select').and.returnValue({ populate: jasmine.createSpy('populate').and.returnValue({ populate: jasmine.createSpy('populate').and.returnValue(Promise.resolve([])) }) }) });
        spyOn(Policy, 'find').and.returnValue({ populate: jasmine.createSpy('populate').and.returnValue({ sort: jasmine.createSpy('sort').and.returnValue(Promise.resolve([policy])) }) });
        spyOn(Renewal, 'find').and.returnValue({ populate: jasmine.createSpy('populate').and.returnValue({ sort: jasmine.createSpy('sort').and.returnValue(Promise.resolve([renewal])) }) });
        spyOn(RenewalApprovalRequest, 'find').and.returnValue({ populate: jasmine.createSpy('populate').and.returnValue({ sort: jasmine.createSpy('sort').and.returnValue(Promise.resolve([{ status: 'APPROVED' }])) }) });
        spyOn(Payment, 'find').and.returnValue({ select: jasmine.createSpy('select').and.returnValue({ sort: jasmine.createSpy('sort').and.returnValue(Promise.resolve([{ renewal: 'renewal_1', status: 'PAID' }])) }) });

        await adminController.getCustomerDetails({ params: { userId: '507f1f77bcf86cd799439011' } }, res);

        const payload = res.json.calls.mostRecent().args[0];
        expect(payload.customer).toEqual(jasmine.objectContaining({ name: 'Customer A' }));
        expect(payload.policies).toEqual([policy]);
        expect(payload.renewals[0].payment.status).toBe('PAID');
        expect(payload.lateRenewalRequests).toEqual([{ status: 'APPROVED' }]);
    });
});
