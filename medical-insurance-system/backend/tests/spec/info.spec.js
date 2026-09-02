const planController = require('../../controllers/planController');
const hospitalRoutes = require('../../routes/hospitalRoutes'); // If logic is in routes
const InsurancePlan = require('../../models/InsurancePlan');
const Hospital = require('../../models/Hospital');

describe('Information Controllers (Plans & Hospitals)', () => {
    let req, res;

    beforeEach(() => {
        res = {
            status: jasmine.createSpy('status').and.callFake(function() { return this; }),
            json: jasmine.createSpy('json')
        };
    });

    it('should fetch all insurance plans', async () => {
        const mockPlans = [{ title: 'Gold Plan', premium: 5000 }];
        spyOn(InsurancePlan, 'find').and.returnValue(Promise.resolve(mockPlans));

        await planController.getPlans({}, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(mockPlans);
    });

    it('should allow admin to add a new hospital', async () => {
        req = { 
            user: { role: 'admin' }, 
            body: { name: 'City Clinic', city: 'Bangalore', location: { lat: 12, lng: 77 } } 
        };
        spyOn(Hospital.prototype, 'save').and.returnValue(Promise.resolve());

        // Note: If this is directly in your routes file as an async fn, 
        // you test the logic inside that specific route handler.
    });
});