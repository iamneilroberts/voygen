-- 022_update_schedules.sql
-- Purpose: Update day-by-day schedules from external HTML docs and attach references

-- Trip 1: European Adventure - Dublin, London & Stoneleigh
UPDATE trips_v2
SET 
  destinations = 'Dublin, London, Stoneleigh',
  primary_client_email = 'chisholm.family@email.com',
  schedule = json_array(
    json_object('day_number',1,'date','2025-09-18','day_name','Departure: Mobile → Dublin','activities',json_array(
      json_object('title','Depart Mobile for Dublin'),
      json_object('title','Overnight flight')
    )),
    json_object('day_number',2,'date','2025-09-19','day_name','Arrive Dublin','activities',json_array(
      json_object('title','Arrive in Dublin morning'),
      json_object('title','Hotel check-in in afternoon'),
      json_object('title','Evening walking tour & Brazen Head dinner')
    )),
    json_object('day_number',3,'date','2025-09-20','day_name','Irish National Stud','activities',json_array(
      json_object('title','Train to Kildare & taxi to National Stud'),
      json_object('title','BA seat selection opens (11:05 AM)')
    )),
    json_object('day_number',4,'date','2025-09-21','day_name','Howth Day Trip','activities',json_array(
      json_object('title','DART to Howth; cliff walk & cruise'),
      json_object('title','Check in for BA flight (11:05 AM)')
    )),
    json_object('day_number',5,'date','2025-09-22','day_name','Dublin → London','activities',json_array(
      json_object('title','Fly to London (Heathrow T5)'),
      json_object('title','Afternoon exploration'),
      json_object('title','Overnight in London')
    )),
    json_object('day_number',6,'date','2025-09-23','day_name','London → Birmingham','activities',json_array(
      json_object('title','Sightseeing & Thames cruise'),
      json_object('title','Evening train to Birmingham')
    )),
    json_object('day_number',7,'date','2025-09-24','day_name','Stoneleigh Work','activities',json_array(
      json_object('title','Stoneleigh work engagement')
    )),
    json_object('day_number',8,'date','2025-09-25','day_name','Stoneleigh Work','activities',json_array(
      json_object('title','Stoneleigh work engagement')
    )),
    json_object('day_number',9,'date','2025-09-26','day_name','Stoneleigh Work','activities',json_array(
      json_object('title','Stoneleigh work engagement')
    )),
    json_object('day_number',10,'date','2025-09-27','day_name','Stoneleigh + Return Prep','activities',json_array(
      json_object('title','Stoneleigh work engagement'),
      json_object('title','Check in for return flights (5:55 AM)')
    )),
    json_object('day_number',11,'date','2025-09-28','day_name','Return Travel','activities',json_array(
      json_object('title','Birmingham → Mobile return travel')
    ))
  )
WHERE trip_id = 1;

-- Attach HTML itinerary document to Trip 1
UPDATE trips_v2
SET documents = CASE 
  WHEN documents IS NULL OR documents = '[]' THEN json_array(json_object(
    'type','itinerary_html','name','European Adventure Guide (Sept 18-28, 2025)',
    'path','examples/chisolm-trip-details.html','last_updated','2025-08-08'
  ))
  ELSE json_insert(documents, '$[#]', json_object(
    'type','itinerary_html','name','European Adventure Guide (Sept 18-28, 2025)',
    'path','examples/chisolm-trip-details.html','last_updated','2025-08-08'
  ))
END
WHERE trip_id = 1;

-- Trip 44: Sara & Darren Jones - Bristol & Bath
UPDATE trips_v2
SET 
  destinations = 'Bath, Winchester, Bristol',
  primary_client_email = 'sara.jones@email.com',
  schedule = json_array(
    json_object('day_number',1,'date','2025-10-05','day_name','Depart US → UK','activities',json_array(
      json_object('title','Overnight flight to UK')
    )),
    json_object('day_number',2,'date','2025-10-06','day_name','Arrive Bristol → Bath','activities',json_array(
      json_object('title','Arrive Bristol (BRS) 9:05 AM'),
      json_object('title','Drive to Bath & check-in')
    )),
    json_object('day_number',3,'date','2025-10-07','day_name','Bath Highlights','activities',json_array(
      json_object('title','Bath City Highlights Walk (confirmed)'),
      json_object('title','Pulteney Bridge, Bath Abbey')
    )),
    json_object('day_number',4,'date','2025-10-08','day_name','Bath Discovery','activities',json_array(
      json_object('title','Independent discovery; Roman Baths Kitchen or Coraggio')
    )),
    json_object('day_number',5,'date','2025-10-09','day_name','Roman Baths Tour','activities',json_array(
      json_object('title','Roman Baths Tour (included)')
    )),
    json_object('day_number',6,'date','2025-10-10','day_name','Winchester Day Trip','activities',json_array(
      json_object('title','Train round-trip to Winchester')
    )),
    json_object('day_number',7,'date','2025-10-11','day_name','Transfer to Bristol','activities',json_array(
      json_object('title','Drive Bath → Bristol (Berwick Lodge)')
    )),
    json_object('day_number',8,'date','2025-10-12','day_name','Bristol Exploration','activities',json_array(
      json_object('title','Explore Bristol')
    )),
    json_object('day_number',9,'date','2025-10-13','day_name','Cotswolds/Region','activities',json_array(
      json_object('title','Regional exploration')
    )),
    json_object('day_number',10,'date','2025-10-14','day_name','Bristol Leisure','activities',json_array(
      json_object('title','Leisure day; pack for departure')
    )),
    json_object('day_number',11,'date','2025-10-15','day_name','Return Travel','activities',json_array(
      json_object('title','Bristol Airport departure 9:20 AM')
    ))
  )
WHERE trip_id = 44;

-- Attach HTML itinerary document to Trip 44
UPDATE trips_v2
SET documents = CASE 
  WHEN documents IS NULL OR documents = '[]' THEN json_array(json_object(
    'type','itinerary_html','name','Sara & Darren 25th Anniversary (Oct 5-15, 2025)',
    'path','examples/sara-darren-jones-anniversary-itinerary.html','last_updated','2025-08-08'
  ))
  ELSE json_insert(documents, '$[#]', json_object(
    'type','itinerary_html','name','Sara & Darren 25th Anniversary (Oct 5-15, 2025)',
    'path','examples/sara-darren-jones-anniversary-itinerary.html','last_updated','2025-08-08'
  ))
END
WHERE trip_id = 44;

