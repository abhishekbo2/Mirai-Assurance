exports.calculatePremium = (basePremium, userProfile) => {
  let finalPremium = basePremium;

  if (userProfile.age > 45) finalPremium *= 1.20; 

  if (userProfile.hasDiabetes) finalPremium += 2000;
  if (userProfile.hasHypertension) finalPremium += 1500;

  const tier1Cities = ['Mumbai', 'Bangalore', 'Delhi', 'Chennai'];
  if (tier1Cities.includes(userProfile.city)) {
    finalPremium += 1000;
  }

  return Math.round(finalPremium);
};