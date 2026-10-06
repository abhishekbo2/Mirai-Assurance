const applicationController = require('../../controllers/applicationController');
const Application = require('../../models/Application');
const InsurancePlan = require('../../models/InsurancePlan');

describe('Application Controller Unit Tests', () => {
    let req, res;

    beforeEach(() => {
        // Mocking the Request object with a user ID from your protect middleware
        req = { 
            body: {}, 
            user: { id: 'user_99' } 
        };
        // Mocking the Response object with chainable spies
        res = {
            status: jasmine.createSpy('status').and.callFake(function() { return this; }),
            json: jasmine.createSpy('json')
        };
    });

    it('should return 400 if user has already applied for the same plan', async () => {
        req.body = { planId: 'plan_ABC', applicantAge: 30, healthDeclaration: { diabetes: false } };

        // Mocking findOne to simulate that an application already exists
        spyOn(Application, 'findOne').and.returnValue(Promise.resolve({ id: 'existing_app' }));
        spyOn(InsurancePlan, 'findById').and.returnValue(Promise.resolve({ minEligibleAge: 18, maxEligibleAge: 65 }));

        await applicationController.applyForPlan(req, res);

        expect(Application.findOne).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ msg: "You have already applied for this plan" });
    });

    it('should return 201 when a new application is submitted successfully', async () => {
        req.body = { planId: 'plan_XYZ', applicantAge: 30, healthDeclaration: { diabetes: false } };

        // Mocking findOne to return null (no existing application)
        spyOn(Application, 'findOne').and.returnValue(Promise.resolve(null));
        spyOn(InsurancePlan, 'findById').and.returnValue(Promise.resolve({ minEligibleAge: 18, maxEligibleAge: 65 }));
        // Mocking the save method on the Application prototype
        spyOn(Application.prototype, 'save').and.returnValue(Promise.resolve());

        await applicationController.applyForPlan(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(jasmine.objectContaining({ 
            msg: "Application submitted successfully" 
        }));
    });

    it('should reject applications for an inactive plan', async () => {
        req.body = { planId: 'inactive_plan', applicantAge: 30, healthDeclaration: { diabetes: false } };
        spyOn(InsurancePlan, 'findById').and.returnValue(Promise.resolve({ isActive: false }));

        await applicationController.applyForPlan(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ msg: 'This plan is no longer available for new applications.' });
    });

    it('should successfully fetch all applications for the logged-in user', async () => {
        const mockApps = [
            { id: '1', plan: { title: 'Health Basic' } },
            { id: '2', plan: { title: 'Star Comprehensive' } }
        ];

        // Mocking the find().populate() chain
        const findSpy = spyOn(Application, 'find').and.returnValue({
            populate: jasmine.createSpy('populate').and.returnValue(Promise.resolve(mockApps))
        });

        await applicationController.getMyApplications(req, res);

        expect(Application.find).toHaveBeenCalledWith({ user: 'user_99' });
        expect(res.json).toHaveBeenCalledWith(mockApps);
    });
});
