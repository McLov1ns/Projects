import xarray as xr

# Открытие NetCDF-файла
ds = xr.open_dataset("C:\\Projects\\pollution-backend\\res_annotated_all.nc")
print(ds)

try:
    time = ds['Times'].values
except KeyError:
    time = ds['time'].values
print(time)