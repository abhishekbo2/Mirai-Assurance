const claimController = require('../../controllers/claimController');
const Claim = require('../../models/Claim');

describe('Claim Controller Unit Tests', () => {
    let req, res;

    beforeEach(() => {
        req = { body: {}, user: { id: 'user123' } };
        res = {
            status: jasmine.createSpy('status').and.callFake(function() { return this; }),
            json: jasmine.createSpy('json')
        };
    });

    it('should successfully file a Cashless claim', async () => {
        req.body = { 
            policyId: 'pol1', 
            type: 'Cashless', 
            amount: 5000, 
            hospitalId: 'hosp1' 
        };

        spyOn(Claim.prototype, 'save').and.returnValue(Promise.resolve());

        await claimController.fileClaim(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(jasmine.objectContaining({ 
            msg: "Claim submitted successfully" 
        }));
    });

    it('should return 500 if the database save fails', async () => {
        req.body = { amount: 100 };
        spyOn(Claim.prototype, 'save').and.returnValue(Promise.reject(new Error("DB Error")));

        await claimController.fileClaim(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ msg: "DB Error" });
    });
});