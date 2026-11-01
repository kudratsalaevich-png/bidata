import json,re
from pathlib import Path
from typing import Optional
from fastapi import HTTPException, Query

def register_digest_routes(app,root):
    folder=Path(root)/'data/daily_digest'
    def files():
        return sorted([p for p in folder.glob('????-??-??.json') if re.fullmatch(r'\d{4}-\d{2}-\d{2}\.json',p.name)],reverse=True)
    @app.get('/api/digest/v3/archive')
    def digest_archive():
        return {'dates':[p.stem for p in files()]}
    @app.get('/api/digest/v3/data')
    def digest_data(date_value:Optional[str]=Query(None,alias='date')):
        if date_value:
            if not re.fullmatch(r'\d{4}-\d{2}-\d{2}',date_value):raise HTTPException(400,'Invalid archive date')
            path=folder/(date_value+'.json')
        else:
            available=files()
            if not available:raise HTTPException(404,'Daily digest has not been built yet')
            path=available[0]
        if not path.is_file():raise HTTPException(404,'Archive not found')
        try:data=json.loads(path.read_text(encoding='utf-8'))
        except (OSError,ValueError):raise HTTPException(503,'Digest snapshot unavailable')
        if data.get('schema_version')!=3:raise HTTPException(503,'Unsupported digest snapshot')
        return data
