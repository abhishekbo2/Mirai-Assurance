const adminController = require('../../controllers/adminController');
const User = require('../../models/User');
const Application = require('../../models/Application');
const nodemailer = require('nodemailer');

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
});
