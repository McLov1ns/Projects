import xarray as xr
import pandas as pd

# Открытие NetCDF-файла
ds = xr.open_dataset("C:\\Projects\\pollution-backend\\res_annotated_direct.nc")
dss = xr.open_dataset("C:\\Projects\\pollution-backend\\res_annotated_all.nc")
print(dss)

# try:
#     time = ds['Times'].values
# except KeyError:
#     time = ds['time'].values
# print(time)